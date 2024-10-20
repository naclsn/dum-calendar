/*-*/; (onload = function() {
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

    document.head.appendChild(elem('title', {}, (new Date).toLocaleDateString()));
    /** @var {InstanceType<CalMonthsBar>} monthsBar */
    /** @var {InstanceType<CalScrollView>} scrollView */
    /** @var {InstanceType<CalTodayNotes>} todayNotes */

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
    const VISIBLE_WEEKS_COUNT = 8;
    const MIN_SCROLL_DIST = 30; // px

    custom('cal-week', class extends HTMLElement {
        /** @type {HTMLSpanElement} */ days;
        /** @type {HTMLDivElement} */ num;

        connectedCallback() {
            const monday = new Date(+this.dataset.monday);

            for (const day of this.days.children) {
                const date = monday.getDate();
                day.textContent = date;
                day.className = MONTHS[monday.getMonth()].id;
                day.onpointerup = _ => todayNotes.dataset.day = new Date(+this.dataset.monday).setDate(date);
                monday.setDate(monday.getDate() + 1);
            }

            monday.setDate(monday.getDate() - 3); // make it Thursday
            const first = new Date(monday.getFullYear(), 0);
            const weekNum = Math.ceil((((monday - first) / 86400000) + 1) / 7);
            this.num.textContent = weekNum;
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
                for (const day of this.days.children)
                    map.set(day.className, (map.get(day.className) || 0) + ratio);
            }

            return map;
        }
    });

    custom('cal-months-bar', class extends HTMLElement {
        /** @type {HTMLDivElement} */ months;

        /** @param {Map<string, number>} map */
        updateVisibleMonths(map) {
            const total = VISIBLE_WEEKS_COUNT * 7;
            const months = this.months;
            let k = 0;
            for (const [id, nb] of map) {
                /** @type {HTMLElement} */
                const month = months.children[k++] || months.appendChild(elem('div'));
                month.className = id;
                month.style.width = nb / total * 100 + '%';
                month.textContent = MONTHS[MONTHS[id]].name;
            }
            while (k < months.children.length) months.removeChild(months.lastElementChild);
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
            first.setDate(first.getDate() - (sinceMonday < 0 ? 6 : sinceMonday) - VISIBLE_WEEKS_COUNT * 7);

            this.scrollTop = 0;
            for (let k = 0; k < VISIBLE_WEEKS_COUNT * 3; ++k) {
                this.appendChild(elem('cal-week', { 'data-monday': +first }));
                first.setDate(first.getDate() + 7);
            }

            addEventListener('resize', _ => this.style.height = this.firstElementChild.clientHeight * VISIBLE_WEEKS_COUNT + 'px');
            setTimeout(() => {
                this.style.height = this.firstElementChild.clientHeight * VISIBLE_WEEKS_COUNT + 'px';
                const a = this.children[VISIBLE_WEEKS_COUNT - 1].getBoundingClientRect();
                const b = this.getBoundingClientRect();
                this.virtualScrollBy(this.scrollTop - (a.top - b.top));
            });

            this.onpointerdown = ev => {
                ev.preventDefault();
                this.pointerInitialY = this.pointerLastY = ev.y;
                this.pointerMovedEnough = false;
            };

            addEventListener('pointermove', ev => {
                if (this.pointerLastY) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.virtualScrollBy(ev.y - this.pointerLastY);
                    this.pointerLastY = ev.y;
                    if (MIN_SCROLL_DIST < Math.abs(ev.y - this.pointerInitialY)) this.pointerMovedEnough = true;
                }
            });

            addEventListener('pointerup', ev => {
                if (this.pointerLastY) {
                    if (this.pointerMovedEnough) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    delete this.pointerLastY;
                }
            }, true);

            this.onwheel = ev => this.virtualScrollBy(-ev.deltaY / 2);
        }

        virtualScrollBy(dy) {
            let should = this.scrollTop - dy;

            while (should < 0) {
                const prevFirst = this.firstElementChild;
                const newFirst = this.lastElementChild;

                const monday = new Date(+prevFirst.dataset.monday);
                newFirst.dataset.monday = monday.setDate(monday.getDate() - 7);

                this.insertBefore(newFirst, prevFirst);
                should += newFirst.clientHeight;
            }

            while (this.clientHeight < should) {
                const prevLast = this.lastElementChild;
                const newLast = this.firstElementChild;

                const monday = new Date(+prevLast.dataset.monday);
                newLast.dataset.monday = monday.setDate(monday.getDate() + 7);

                this.appendChild(newLast);
                should -= newLast.clientHeight;
            }

            this.scrollTop = should;

            const overMonth = new Map;
            for (const week of this.children) {
                /** @type {Map<string, number>} */
                const overWeek = week.visibleDaysRatios(); // rem: total of 7, not 1
                for (const [id, nb] of overWeek) overMonth.set(id, (overMonth.get(id) || 0) + nb);
            }

            monthsBar.updateVisibleMonths(overMonth);
        }
    });

    custom('cal-today-notes', class extends HTMLElement {
        static observedAttributes = ['data-day'];

        /** @type {HTMLHeadingElement} */ title;
        /** @type {HTMLUListElement} */ list;

        connectedCallback() {
            this.attributeChangedCallback();
        }

        attributeChangedCallback() {
            const day = new Date(+this.dataset.day || Date.now());
            this.title.textContent = day.toLocaleDateString(undefined, { dateStyle: 'full' });
        }
    });
});
