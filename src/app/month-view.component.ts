// header ('wnum'), (days..)
// content: 6x week
//    week: (wnum), (lskdfjslkjf)

import { Component, Input } from '@angular/core';
import { SnapProcList } from './snap-proc-list.component';

@Component({
    selector: 'week',
    standalone: true,
    imports: [],
    template: `
        <span>{{weekInYear}}</span>
        <span>{{firstDayInMonth+0}}</span>
        <span>{{firstDayInMonth+1}}</span>
        <span>{{firstDayInMonth+2}}</span>
        <span>{{firstDayInMonth+3}}</span>
        <span>{{firstDayInMonth+4}}</span>
        <span>{{firstDayInMonth+5}}</span>
        <span>{{firstDayInMonth+6}}</span>
    `,
    styles: `
        span {
            display: inline-block;
            width: 3rem;
            text-align: right;
        }
    `,
})
export class WeekComponent {

    @Input() weekInYear!: number;
    @Input() firstDayInMonth!: number;

}

@Component({
    selector: 'month-view',
    standalone: true,
    imports: [WeekComponent, SnapProcList],
    template: `
        <p>n, mon.tue.wed.thu.fri.sat.sun</p>
        <snap-proc-list
            [firstIndex]=0 [showCount]=6
            [component]=component [nthInputs]=getWeek />
    `,
    styles: ``,
})
export class MonthViewComponent {

    component = WeekComponent;
    getWeek(n: number) {
        return {
            weekInYear: n,
            firstDayInMonth: 7*n,
        };
    }

}
