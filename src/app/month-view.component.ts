// header ('wnum'), (days..)
// content: 6x week
//    week: (wnum), (lskdfjslkjf)

import { Component, Input } from '@angular/core';
import { SnapProcList } from './snap-proc-list.component';

type DayInfo = {
    number: number;
    monthId: string;
};

@Component({
    selector: 'week',
    standalone: true,
    imports: [],
    template: `
        <span>{{weekNumber}}</span>
        @for (day of days; track $index) {
            <span [class]=day.monthId>{{day.number}}</span>
        }
    `,
    styles: `
        .jan { --color: skyblue; }
        .feb { --color: pink; }
        .mar { --color: lime; }
        .apr { --color: orange; }
        .may { --color: gold; }
        .jun { --color: cyan; }
        .jul { --color: red; }
        .aug { --color: yellow; }
        .sep { --color: cornflowerblue; }
        .oct { --color: purple; }
        .nov { --color: green; }
        .dec { --color: darkcyan; }

        span {
            display: inline-block;
            width: 3rem;
            height: 3rem;
            text-align: right;
            color: var(--color);
        }
    `,
})
export class WeekComponent {

    @Input() weekNumber!: number;
    @Input() days!: DayInfo[];

}

@Component({
    selector: 'month-view',
    standalone: true,
    imports: [WeekComponent, SnapProcList],
    template: `
        <p>TODO: header (n, mon.tue.wed.thu.fri.sat.sun), year, months, maybe change snapping logic, data layer, styling</p>
        <snap-proc-list
            [firstIndex]=firstIndex() [showCount]=7
            [component]=component [nthInputs]=getWeek />
    `,
    styles: `
    `,
})
export class MonthViewComponent {

    component = WeekComponent;
    firstIndex() {
        const weeksSinceZero = (Date.now() / MonthViewComponent.MS_IN_WEEK) |0;
        // rem: to center in, so +3 rows (base 0)
        return weeksSinceZero - (3-weeksSinceZero%7);
    }

    static MONTHS = [
        { days: 31, id: 'jan', name: 'January',   },
        { days: 28, id: 'feb', name: 'February',  },
        { days: 31, id: 'mar', name: 'March',     },
        { days: 30, id: 'apr', name: 'April',     },
        { days: 31, id: 'may', name: 'May',       },
        { days: 30, id: 'jun', name: 'June',      },
        { days: 31, id: 'jul', name: 'July',      },
        { days: 31, id: 'aug', name: 'August',    },
        { days: 30, id: 'sep', name: 'September', },
        { days: 31, id: 'oct', name: 'October',   },
        { days: 30, id: 'nov', name: 'November',  },
        { days: 31, id: 'dec', name: 'December',  },
    ];
    static MS_IN_DAY = 86400000;
    static MS_IN_WEEK = MonthViewComponent.MS_IN_DAY*7;

    async getWeek(weekInTime: number) {
        // rem: -3 days is because date(0) is a thursday
        const monday = new Date(weekInTime * MonthViewComponent.MS_IN_WEEK - 3*MonthViewComponent.MS_IN_DAY);
        const yearInTime = monday.getFullYear();
        const monthInYear = monday.getMonth();
        const dayInMonth = monday.getDate();

        const month = MonthViewComponent.MONTHS[monthInYear];
        // rem: leap years
        const daysInMonth = month.days + (!(yearInTime%4) && (!(yearInTime%100) || yearInTime%400) ?1:0);

        const days: DayInfo[] = [];
        for (let k = 0; k < 7; ++k) {
            if (dayInMonth+k <= daysInMonth) {
                days.push({
                    number: dayInMonth+k,
                    monthId: month.id,
                });
            } else {
                days.push({
                    number: (dayInMonth+k) % daysInMonth,
                    monthId: MonthViewComponent.MONTHS[(monthInYear+1)%12].id,
                });
            }
        }

        const firstWeekInTime = ((new Date(yearInTime, 0)).getTime() / MonthViewComponent.MS_IN_WEEK) |0;
        const weekNumber = weekInTime - firstWeekInTime;

        return {
            weekNumber,
            days,
        };
    }

}
