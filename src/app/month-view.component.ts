import { Component, Pipe, Input, inject, PipeTransform } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { CalendarService } from './calendar.service';
import { SnapProcList } from './snap-proc-list.component';

type DayInfo = {
    number: number;
    monthId: string;
};

type Ins = {
    weekNumber: number;
    days: DayInfo[];
};

/// a <week /> is one row in the month view {{{
@Component({
    selector: 'week',
    standalone: true,
    imports: [],
    template: `
        <span>{{weekNumber}}</span>
        @for (day of days; track $index) {
            <span
                [class]=day.monthId
                (pointerup)='theNth($event,day.monthId, day.number)'
            >{{day.number}}</span>
        }
    `,
    styles: `
        :host {
            margin: 0px;
        }

        span {
            display: inline-block;
            width: 3rem;
            height: var(--week-row-height);
            text-align: right;
            color: var(--month-color);
        }
    `,
})
export class WeekComponent {

    @Input() weekNumber!: number;
    @Input() days!: DayInfo[];

    private calendar = inject(CalendarService);

    theNth(ev: PointerEvent, id: string, nth: number) {
        console.log("coucou");
        if (ev.defaultPrevented) return;
        this.calendar.showDayRequest(new Date(
            (new Date).getFullYear(),
            MonthViewComponent.MONTHS_BY_ID[id].index,
            nth
        ));
    }

}
// }}}

/// the <months /> is the indicator of the months above the main view part {{{
@Component({
    selector: 'months',
    standalone: true,
    template: `
        @for (month of months; track $index) {
            <span
                [style]='"--ratio: "+month.ratio'
                [class]=month.id
                (click)=theFirst(month.id)
            >
                {{nameFor(month.id)}}
            </span>
        }
    `,
    styles: `
        :host {
            display: inline-block;
            width: 100%;
            --height: 2rem;
            height: var(--height);
        }

        span {
            display: inline-block;
            height: 100%;

            width: calc(100% * var(--ratio));

            border-radius: calc(var(--height) / 2);
            background-color: var(--month-color);

            font-size: calc(3 / 5 * var(--height));
            text-indent: calc(var(--height) / 2);
            overflow: clip;
        }

        span:first-of-type {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
        }
        span:last-of-type {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
        }
    `,
})
export class MonthsComponent {

    @Input() months: { id: string, ratio: number }[] = [];

    nameFor(id: string): string {
        return MonthViewComponent.MONTHS_BY_ID[id].name;
    }

    private calendar = inject(CalendarService);

    theFirst(id: string) {
        this.calendar.showDayRequest(new Date(
            (new Date).getFullYear(),
            MonthViewComponent.MONTHS_BY_ID[id].index,
        ));
    }

}
// }}}

/// Date -> week index (Date(0) is week 0)
@Pipe({
    name: 'weekIndex',
    standalone: true,
})
export class WeekIndexPipe implements PipeTransform {

    transform(date: Date | null): number | null {
        if (!date) return null;
        const withThuOffset = date.getTime() - 3*MonthViewComponent.MS_IN_DAY;
        const weeksSinceZero = (withThuOffset / MonthViewComponent.MS_IN_WEEK) |0;
        return weeksSinceZero+1;
    }

}

/// the main component of this file {{{
@Component({
    selector: 'month-view',
    standalone: true,
    imports: [WeekComponent, MonthsComponent, SnapProcList, AsyncPipe, WeekIndexPipe],
    template: `
        <months [months]=visibleMonths />
        <snap-proc-list
            [component]=component
            [firstIndex]=firstIndex
            [nthInputs]=getWeek
            [snapToClosestNow]="showRequest$ | async | weekIndex"
            (onVirtualScroll)=visibleUpdated($event)
            [snapOffsetPx]='23/2'
            [snapOffsetElm]=-1 />
    `,
    styles: `
        :host {
            --week-row-height: 2.5rem;
        }

        snap-proc-list {
            height: calc(var(--week-row-height) * 7);
        }
    `,
})
export class MonthViewComponent {

    component = WeekComponent;
    get firstIndex() {
        const withThuOffset = Date.now() - 3*MonthViewComponent.MS_IN_DAY;
        const weeksSinceZero = (withThuOffset / MonthViewComponent.MS_IN_WEEK) |0;
        return weeksSinceZero+1;
    }

    showRequest$ = inject(CalendarService).showDayRequest$;

    visibleMonths: { id: string, ratio: number }[] = [];

    static MONTHS = (() => {
        const r: { days: number, id: string, name: string, index: number }[] = [
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
        ] as any;
        const format = new Intl.DateTimeFormat(undefined, { month: 'long' });
        for (const [k, it] of r.entries()) {
            it.name = format.format(new Date(0, k));
            it.index = k;
        }
        return r;
    })();
    static MONTHS_BY_ID = Object.fromEntries(MonthViewComponent.MONTHS.map(it => [it.id, it]));
    static MS_IN_DAY = 86400000;
    static MS_IN_WEEK = MonthViewComponent.MS_IN_DAY*7;

    getWeek(weekInTime: number): { control: boolean; promise: Promise<Ins>; } {
        // rem: -3 days is because date(0) is a thursday
        const monday = new Date(weekInTime * MonthViewComponent.MS_IN_WEEK - 3*MonthViewComponent.MS_IN_DAY);
        const yearInTime = monday.getFullYear();
        const monthInYear = monday.getMonth();
        const dayInMonth = monday.getDate();

        const month = MonthViewComponent.MONTHS[monthInYear];
        // rem: +(.. ?1:0) leap years
        const daysInMonth = month.days + (1 == monthInYear && !(yearInTime%4) && (!(yearInTime%100) || yearInTime%400) ?1:0);

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
            control: days.some(day => 1 == day.number),
            promise: Promise.resolve({
                weekNumber,
                days,
            }),
        };
    }

    visibleUpdated({ visible }: { visible: { inputs: Ins }[] }) {
        const visibleMonthDayCount = new Map<string, number>;
        for (const { inputs } of visible) {
            for (const { monthId } of inputs.days) {
                const count = visibleMonthDayCount.get(monthId) ?? 0;
                visibleMonthDayCount.set(monthId, count+1);
            }
        }

        this.visibleMonths.length = 0;
        const totalNumDays = 7*visible.length;
        for (const [id, count] of visibleMonthDayCount.entries()) {
            this.visibleMonths.push({ id, ratio: count/totalNumDays });
        }
    }

}
// }}}
