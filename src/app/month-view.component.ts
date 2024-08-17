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
        <span>{{week_in_year}}: {{first_day_in_month}}..</span>
    `,
    styles: ``
})
export class WeekComponent {
    @Input() week_in_year!: number;
    @Input() first_day_in_month!: number;
}

@Component({
    selector: 'month-view',
    standalone: true,
    imports: [WeekComponent, SnapProcList],
    template: `
        <p>header</p>
        <snap-proc-list
            [first_index]=0 [show_count]=6
            [component]=component [nth_inputs]=bidoof />
    `,
    styles: ``
})
export class MonthViewComponent {
    top!: number;
    component = WeekComponent;
    bidoof = (n: number) => ({
        week_in_year: n,
        first_day_in_month: 42,
    });
}
