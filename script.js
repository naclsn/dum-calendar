/// <reference path="database.js" />
/*-*/; (onload = function() { 'use strict';
    // lib {{{
    /**
     * @param {string} tagName
     * @param {C} cls
     * @param {string} [from]
     * @template {new() => HTMLElement} C
     *
     * rem: existing callbacks are:
     * - connectedCallback
     * - disconnectedCallback
     * - adoptedCallback
     * - attributeChangedCallback (must have a static observedAttributes be a list of names)
     */
    function custom(tagName, cls, from) {
        const template = window[tagName];
        // @ts-ignore: mixin must ...args: any[]
        if (template) cls = class extends cls {
            constructor() {
                super()
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.adoptedStyleSheets = custom.documentStyles;
                shadow.appendChild(template.content.cloneNode(true));
                // @ts-ignore: iterable
                for (const child of shadow.querySelectorAll('*[id]')) this[child.id] = child;
            }
        };
        customElements.define(tagName, cls, from ? { extends: from } : undefined);
        return cls;
    }
    custom.documentStyles = [];
    // @ts-ignore: iterable
    for (const style of document.head.getElementsByTagName('style')) {
        const sheet = new CSSStyleSheet;
        sheet.replaceSync(style.textContent);
        custom.documentStyles.push(sheet);
    }

    /**
     * @param {string} tagName
     * @param {Record<string, any>} [attrs]
     * @param {string} [content]
     */
    function elem(tagName, attrs, content) {
        /** @type {HTMLElement} */
        const r = document.createElement(tagName);
        if (attrs) {
            if (attrs.style && 'string' !== typeof attrs.style) {
                for (const name in attrs.style) r.style[name] = attrs.style[name];
                delete attrs.style;
            }
            for (const name in attrs) r.setAttribute(name, attrs[name]);
        }
        if (content) r.innerHTML = content;
        return r;
    }
    // }}}

    // consts {{{
    /** @typedef {Event & {detail: Date}} DayChangedEvent */
    /** @typedef {Event & {detail: [IDBValidKey, Activity]}} ActivityAddedEvent */

    const NOW = new Date
    const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    /** @var {InstanceType<CalMonthsBar>} monthsBar */
    /** @var {InstanceType<CalScrollView>} scrollView */
    /** @var {InstanceType<CalTodayNotes>} todayNotes */
    /** @event {Date | number} daychanged */

    /** @type {{days: number, id: string, name: string}[]} */
    // @ts-ignore: name
    const MONTHS = [{days:31,id:'jan'},{days:28,id:'feb'},{days:31,id:'mar'},{days:30,id:'apr'},{days:31,id:'may'},{days:30,id:'jun'},{days:31,id:'jul'},{days:31,id:'aug'},{days:30,id:'sep'},{days:31,id:'oct'},{days:30,id:'nov'},{days:31,id:'dec'}];
    for (let k = 0; k < MONTHS.length; ++k) {
        MONTHS[k].name = new Date(0, k).toLocaleString(undefined, { month: 'long' });
        MONTHS[MONTHS[k].id] = k;
    }

    /** @param {Activity} act */
    function activityColor(act) {
        const hash = act.note.split("\n", 1)[0].split("").reduce((acc, cur) => ((acc << 5) - acc + cur.charCodeAt(0))|0, 0);
        return 'hsl(' + hash%360 + ', 80%, 50%)';
    }

    const DAY_BEGINS = 7 * 60*60*1000;
    const DAY_ENDS = 22 * 60*60*1000;
    // }}}

    // db {{{
    class Activity {
        static objectStoreOptions = { autoIncrement: true };
        static objectStoreIndexes = {
            day: { keyPath: 'day' },
            occurrences: { keyPath: 'occurrences' },
            interval: { keyPath: 'interval' },
        };

        note = "(empty note)";
        /** date (ms) */ day = +TODAY;
        /** @type {number?} time (ms) */ begins = null;
        /** @type {number?} time (ms) */ ends = null;

        /** @type {'lingers' | number | 'monthly' | 'yearly'} */ interval = 0;
        skips = 0;
        occurrences = 0; // 0 is no repeat, 1 is infinite occurrences since `day`, more is count

        constructor(from) {
            if (from) Object.assign(this, from);
        }
    }

    //class Adjustment {
    //    static objectStoreOptions = { autoIncrement: true };
    //    static objectStoreIndexes = { act: { keyPath: 'act' } };
    //
    //    act = 0;
    //
    //    shift = 0;
    //}

    const db = database('dum-calendar', 2, { Activity });
    // }}}

    // elements {{{
    custom('cal-week-day', class extends HTMLElement {
        /** @type {HTMLSpanElement} */ num;
        /** @type {HTMLDivElement} */ acts;
        /** @type {Set<IDBValidKey>} */ keys = new Set;

        static observedAttributes = ['data-date'];
        attributeChangedCallback() {
            this.num.textContent = this.dataset.date;
            this.acts.textContent = null;
            this.keys.clear();
        }

        /**
         * @param {IDBValidKey} key
         * @param {Activity} act
         */
        addActivity(key, act) {
            if (this.keys.has(key)) return;
            this.keys.add(key);

            const hundred = (DAY_ENDS-DAY_BEGINS)/100;
            const niw = elem('div', {
                style: {
                    height: (act.ends-act.begins) / hundred+'%',
                    backgroundColor: activityColor(act),
                    top: (act.begins-DAY_BEGINS) / hundred+'%',
                },
                'data-begins': act.begins,
                'data-ends': act.ends,
            });

            // @ts-ignore: upcast
            if (!this.acts.childElementCount || this.acts.lastElementChild.dataset.ends < act.begins)
                this.acts.appendChild(niw);
            // @ts-ignore: iterable
            else for (const ch of this.acts.children) if (act.begins <= ch.dataset.ends) {
                this.acts.insertBefore(niw, ch);
                break;
            }
        }
    });

    custom('cal-week', class extends HTMLElement {
        /** @type {HTMLSpanElement} */ days;
        /** @type {HTMLDivElement} */ num;

        /** @type {HTMLDivElement?} */ selected = null;

        connectedCallback() {
            if (this.selected) {
                this.selected.id = '';
                this.selected = null;
            }

            const monday = new Date(+this.dataset.monday);

            const curr = new Date(monday);
            // @ts-ignore: iterable
            for (const day of this.days.children) {
                day.dataset.date = curr.getDate();
                day.className = MONTHS[curr.getMonth()].id;

                const timestamp = +curr;
                if (+todayNotes.dataset.day === timestamp) {
                    this.selected = day;
                    this.selected.id = 'selected-day';
                }
                day.onclick = _ => dispatchEvent(new CustomEvent('daychanged', { detail: timestamp }));

                curr.setDate(curr.getDate() + 1);
            }

            db.transaction(Activity).then(tr => {
                const dayIndex = tr.index('day');
                const curr = new Date(monday);
                // @ts-ignore: iterable
                for (const day of this.days.children) {
                    dayIndex.cursor(+curr).forEach(([key, act]) => day.addActivity(key, act));
                    curr.setDate(curr.getDate() + 1);
                }

                tr.index('occurrences').cursor(IDBKeyRange.lowerBound(1)).forEach(([key, act]) => {
                    const curr = new Date(monday);
                    // @ts-ignore: iterable
                    for (const day of this.days.children) {
                        // TODO
                        act.occurrences
                        act.interval
                        act.skips
                        if (act.day < +curr) // && ...
                            day.addActivity(key, act)
                        curr.setDate(curr.getDate() + 1);
                    }
                });

                tr.index('interval').cursor('lingers').forEach(([key, act]) => {
                    // @ts-ignore: date arithmetic
                    for (let k = Math.max(0, (act.day-monday) / 86400000 |0); k < this.days.childElementCount; ++k)
                        this.days.children[k].addActivity(key, act)
                });
            });

            addEventListener('daychanged', /** @param {DayChangedEvent} ev */ ev => this.dayChanged(new Date(ev.detail)));
            addEventListener('activityadded', /** @param {ActivityAddedEvent} ev */ ev => {
                const [key, act] = ev.detail;
                const curr = new Date(+this.dataset.monday);
                // @ts-ignore: iterable
                for (const day of this.days.children) {
                    // TODO
                    if (+curr === act.day) // || ...
                        day.addActivity(key, act);
                    curr.setDate(curr.getDate() + 1);
                }
            });

            const thursday = new Date(monday);
            thursday.setDate(thursday.getDate() - 3);
            const first = new Date(thursday.getFullYear(), 0);
            // @ts-ignore: date arithmetic
            const weekNum = Math.ceil((((thursday - first) / 86400000) + 1) / 7);
            // @ts-ignore: toString
            this.num.textContent = weekNum;
        }

        /** @param {Date} day */
        dayChanged(day) {
            if (this.selected) this.selected.id = '';

            const monday = +this.dataset.monday;
            // @ts-ignore: date arithmetic
            if (monday <= day && day < monday + 604800000) {
                const n = day.getDay() - 1; // -1 -> sun, 0 -> mon, ..
                // @ts-ignore: upcast
                this.selected = this.days.children[n < 0 ? 6 : n];
                this.selected.id = 'selected-day';
            }
        }

        visibleDaysRatios() {
            const map = new Map;

            const a = this.parentElement.getBoundingClientRect();
            const b = this.getBoundingClientRect();
            const visible = b.top < a.top ? b.bottom - a.top
                          : a.bottom < b.bottom ? a.bottom - b.top
                          : b.height;

            if (0 < visible) {
                const ratio = visible / b.height;
                // @ts-ignore: iterable
                for (const day of this.days.children) map.set(day.className, (map.get(day.className) || 0) + ratio);
            }

            return map;
        }
    });

    custom('cal-months-bar', class extends HTMLElement {
        /** @type {HTMLDivElement} */ months;

        /** @param {Map<string, [count: number, year: number]>} map */
        updateVisibleMonths(map) {
            if (!map.size) return;
            const total = Array.from(map.values()).reduce((acc, [cur, _]) => acc + cur, 0);
            let k = 0;
            for (const [id, [nb, yr]] of map) {
                /** @type {HTMLElement} */
                // @ts-ignore: upcast
                const month = this.months.children[k++] || this.months.appendChild(elem('div'));
                month.className = id;
                month.style.width = nb / total * 100 + '%';
                month.textContent = MONTHS[MONTHS[id]].name + ' (' + yr + ')';
            }
            while (k < this.months.children.length) this.months.removeChild(this.months.lastElementChild);
        }
    });

    custom('cal-scroll-view', class extends HTMLElement {
        pointerInitialY = 0;
        pointerLastY;
        pointerMovedEnough = false;

        connectedCallback() {
            const today = new Date;
            const first = new Date(today.getFullYear(), today.getMonth());
            const sinceMonday = first.getDay() - 1;
            first.setDate(first.getDate() - (sinceMonday < 0 ? 6 : sinceMonday));

            const before = new Date(first);
            before.setDate(before.getDate() - 7);

            this.style.height = this.clientHeight + 'px';
            for (let total = 0; total < this.clientHeight && this.childElementCount < 99;) {
                total += this.appendChild(elem('cal-week', { 'data-monday': +first })).clientHeight;
                first.setDate(first.getDate() + 7);
            }

            // triple: add one batch before and one after
            const n = this.childElementCount;
            let scroll = 0;
            for (let k = 0; k < n; ++k) {
                this.appendChild(elem('cal-week', { 'data-monday': +first }));
                first.setDate(first.getDate() + 7);

                scroll += this.insertBefore(elem('cal-week', { 'data-monday': +before }), this.firstElementChild).clientHeight;
                before.setDate(before.getDate() - 7);
            }

            this.scrollTop = scroll;
            this.onscroll = this.virtualScroll.bind(this);

            // TODO
            //addEventListener('resize', _ => {
            //    this.style.height = '';
            //    setTimeout(_ => this.style.height = this.clientHeight + 'px');
            //});
        }

        virtualScroll() {
            const times = this.childElementCount / 4;

            while (this.scrollTop < this.firstElementChild.clientHeight * times) {
                const prevFirst = this.firstElementChild;
                const newFirst = this.lastElementChild;
                // @ts-ignore: upcast
                const monday = new Date(+prevFirst.dataset.monday);
                // @ts-ignore: upcast
                newFirst.dataset.monday = monday.setDate(monday.getDate() - 7);

                this.scrollTop += this.insertBefore(newFirst, prevFirst).clientHeight;
            }

            while (this.scrollHeight - this.lastElementChild.clientHeight * times < this.scrollTop + this.clientHeight) {
                const prevLast = this.lastElementChild;
                const newLast = this.firstElementChild;
                // @ts-ignore: upcast
                const monday = new Date(+prevLast.dataset.monday);
                // @ts-ignore: upcast
                newLast.dataset.monday = monday.setDate(monday.getDate() + 7);

                this.scrollTop -= this.appendChild(newLast).clientHeight;
            }

            /** @type {Map<string, [count: number, year: number]>} */
            const overMonth = new Map;
            // @ts-ignore: iterable
            for (const week of this.children) {
                /** @type {Map<string, number>} */
                const overWeek = week.visibleDaysRatios(); // rem: total of 7, not 1
                if (!overWeek.size) continue;

                const year = new Date(+week.dataset.monday).getFullYear();
                // week has at most 2 months ids, the loop is unrolled manually
                const it = overWeek.entries();

                const [id, nb] = it.next().value;
                if (!overMonth.has(id)) overMonth.set(id, [0, year]);
                overMonth.get(id)[0] += nb;

                const again = it.next().value;
                if (again) {
                    const [id, nb] = again;
                    // month check handles December -> Januray
                    if (!overMonth.has(id)) overMonth.set(id, [0, MONTHS[id] ? year : year + 1]);
                    overMonth.get(id)[0] += nb;
                }
            }
            monthsBar.updateVisibleMonths(overMonth);
        }
    });

    custom('cal-today-notes', class extends HTMLElement {
        /** @type {HTMLHeadingElement} */ heading;
        /** @type {HTMLUListElement} */ list;
        /** @type {HTMLButtonElement} */ create;
        /** @type {HTMLFormElement} */ createForm;
        /** @type {HTMLButtonElement} */ createFormDone;

        connectedCallback() {
            addEventListener('daychanged', /** @param {DayChangedEvent} ev */ ev => this.dayChanged(new Date(ev.detail)));
            addEventListener('activityadded', /** @param {ActivityAddedEvent} ev */ ev => {
                const act = ev.detail[1];
                if (+this.dataset.day === act.day)
                    // TODO
                    this.list.appendChild(elem('li', {}, `note: ${act.note}, begins: ${act.begins / 1000/60/60}, ends: ${act.ends / 1000/60/60}`))
            });

            this.create.onclick = _ => {
                this.createForm.style.bottom = '0';
                const day = new Date(+this.dataset.day);
                const f = n => ('0' + n).slice(-2);
                // @ts-ignore: name="day"
                this.createForm.elements.day.value = day.getFullYear() + '-' + f(day.getMonth()+1) + '-' + f(day.getDate());
                // @ts-ignore: name="node"
                this.createForm.elements.note.focus();
            };
            this.createForm.onsubmit = ev => {
                ev.preventDefault();

                /** @type {any} */
                const elems = this.createForm.elements;
                const event = new Activity({
                    note: elems.note.value,
                    day: +new Date(elems.day.value + 'T00:00'),
                    begins: elems.begins.value ? elems.begins.valueAsNumber : null,
                    ends: elems.ends.value ? elems.ends.valueAsNumber : null,

                    interval: isNaN(+elems.interval.value) ? elems.interval.value || 0 : +elems.interval.value,
                    skips: +elems.skips.value || 0,
                    occurrences: +elems.occurrences.value || 0,
                });

                db.transaction(Activity, 'readwrite')
                    .then(tr => tr.add(event))
                    .then(key => dispatchEvent(new CustomEvent('activityadded', { detail: [key, event] })));
                this.createForm.style.removeProperty('bottom');
            };
        }

        /** @param {Date} day */
        dayChanged(day) {
            // @ts-ignore: toString
            this.dataset.day = +day;
            this.heading.textContent = day.toLocaleDateString(undefined, { dateStyle: 'full' });

            this.list.textContent = null;
            db.transaction(Activity).then(tr => tr.index('day').cursor(+day).forEach(([_, act]) =>
                // TODO
                this.list.appendChild(elem('li', {}, `note: ${act.note}, begins: ${act.begins / 1000/60/60}, ends: ${act.ends / 1000/60/60}`))
            ));
        }
    });
    // }}}

    document.head.appendChild(elem('title', {}, TODAY.toLocaleDateString()));
    dispatchEvent(new CustomEvent('daychanged', { detail: TODAY }));
});
