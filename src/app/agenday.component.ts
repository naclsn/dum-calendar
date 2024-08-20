import { Component, inject } from "@angular/core";
import { AsyncPipe, DatePipe } from '@angular/common';
import { CalendarService } from "./calendar.service";

@Component({
    selector: 'agenday',
    standalone: true,
    imports: [AsyncPipe, DatePipe],
    template: `
        <h3>{{ calendar.showDayRequest$ | async | date:'fullDate' }}</h3>
    `,
    styles: `
        :host {
            display: block;

            --paper-like: #f9f5d5;
            --ink-like: #082551;

            background: repeating-linear-gradient(0deg,
                var(--ink-like), var(--ink-like) 0px,
                var(--paper-like) 3px, var(--paper-like) 2rem);
        }

        h3 {
            font-size: 1.5rem;
            text-indent: 1.5rem;
        }
    `,
})
export class AgendayComponent {

    calendar = inject(CalendarService);

}
