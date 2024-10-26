/*-*/; (onload = function() { 'use strict';
    // lib {{{
    /**
     * @param {C} cls
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
        if (template) cls = class extends cls {
            constructor() {
                super()
                const shadow = this.attachShadow({ mode: 'open' });
                shadow.adoptedStyleSheets = custom.documentStyles;
                shadow.appendChild(template.content.cloneNode(true));
                for (const child of shadow.querySelectorAll('*[id]')) this[child.id] = child;
            }
        };
        customElements.define(tagName, cls, from ? { extends: from } : undefined);
        return cls;
    }
    custom.documentStyles = [];
    for (const style of document.head.getElementsByTagName('style')) {
        const sheet = new CSSStyleSheet;
        sheet.replaceSync(style.textContent);
        custom.documentStyles.push(sheet);
    }

    function elem(tag, attrs, content) {
        /** @type {HTMLElement} */
        const r = document.createElement(tag);
        if (attrs) for (const name in attrs) r.setAttribute(name, attrs[name]);
        if (content) r.innerHTML = content;
        return r;
    }
    // }}}

    // consts {{{
    const NOW = new Date
    const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
    /** @var {InstanceType<CalMonthsBar>} monthsBar */
    /** @var {InstanceType<CalScrollView>} scrollView */
    /** @var {InstanceType<CalTodayNotes>} todayNotes */
    /** @event {Date | number} daychanged */

    /** @type {{days: number, id: string, name: string}[]} */
    const MONTHS = [
        { days: 31, id: 'jan' },
        { days: 28, id: 'feb' },
        { days: 31, id: 'mar' },
        { days: 30, id: 'apr' },
        { days: 31, id: 'may' },
        { days: 30, id: 'jun' },
        { days: 31, id: 'jul' },
        { days: 31, id: 'aug' },
        { days: 30, id: 'sep' },
        { days: 31, id: 'oct' },
        { days: 30, id: 'nov' },
        { days: 31, id: 'dec' },
    ];
    for (let k = 0; k < MONTHS.length; ++k) {
        MONTHS[k].name = new Date(0, k).toLocaleString(undefined, { month: 'long' });
        MONTHS[MONTHS[k].id] = k;
    }
    // }}}

    // db {{{
    class CalEvent {
        static objectStoreOptions = { autoIncrement: true };
        static objectStoreIndexes = { day: { keyPath: 'day' } };

        note = '';
        day = TODAY;
        /** @type {Date?} */ begins;
        /** @type {Date?} */ ends;

        repeats = false;
        lingers = false;

        constructor(from) {
            if (from) Object.assign(this, from);
        }
    }

    class CalAdjust {
        static objectStoreOptions = { autoIncrement: true };
    }

    const db = database('dum-calendar', { CalEvent, CalAdjust });
    // }}}

    // elements {{{
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

            for (const day of this.days.children) {
                day.textContent = monday.getDate();
                day.className = MONTHS[monday.getMonth()].id;

                const timestamp = +monday;
                if (todayNotes.dataset.day == timestamp) {
                    this.selected = day;
                    this.selected.id = 'selected-day';
                }
                day.onclick = _ => dispatchEvent(new CustomEvent('daychanged', { detail: timestamp }));

                monday.setDate(monday.getDate() + 1);
            }

            addEventListener('daychanged', ev => this.dayChanged(new Date(ev.detail)));

            monday.setDate(monday.getDate() - 3); // make it Thursday
            const first = new Date(monday.getFullYear(), 0);
            const weekNum = Math.ceil((((monday - first) / 86400000) + 1) / 7);
            this.num.textContent = weekNum;
        }

        /** @param {Date} day */
        dayChanged(day) {
            if (this.selected) this.selected.id = '';

            const monday = +this.dataset.monday;
            if (monday <= day && day < monday + 604800000) {
                const n = day.getDay() - 1; // -1 -> sun, 0 -> mon, ..
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

                const monday = new Date(+prevFirst.dataset.monday);
                newFirst.dataset.monday = monday.setDate(monday.getDate() - 7);

                this.scrollTop += this.insertBefore(newFirst, prevFirst).clientHeight;
            }

            while (this.scrollHeight - this.lastElementChild.clientHeight * times < this.scrollTop + this.clientHeight) {
                const prevLast = this.lastElementChild;
                const newLast = this.firstElementChild;

                const monday = new Date(+prevLast.dataset.monday);
                newLast.dataset.monday = monday.setDate(monday.getDate() + 7);

                this.scrollTop -= this.appendChild(newLast).clientHeight;
            }

            /** @type {Map<string, [count: number, year: number]>} */
            const overMonth = new Map;
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
        /** @type {HTMLHeadingElement} */ title;
        /** @type {HTMLUListElement} */ list;

        connectedCallback() {
            addEventListener('daychanged', ev => this.dayChanged(new Date(ev.detail)));
        }

        /** @param {Date} day */
        dayChanged(day) {
            this.dataset.day = +day;
            this.title.textContent = day.toLocaleDateString(undefined, { dateStyle: 'full' });

            //const events = await db.transaction(CalEvent).index('day').get(..);
        }
    });
    // }}}

    // init {{{
    document.head.appendChild(elem('title', {}, TODAY.toLocaleDateString()));
    dispatchEvent(new CustomEvent('daychanged', { detail: TODAY }));
    // }}}
});
