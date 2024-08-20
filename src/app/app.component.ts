import { Component, inject } from '@angular/core';
import { CalendarService } from './calendar.service';
import { TopBarComponent } from './top-bar.component';
import { MonthViewComponent } from './month-view.component';
import { AgendayComponent } from './agenday.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [TopBarComponent, MonthViewComponent, AgendayComponent],
    template: `
        <top-bar (click)=today() />
        <month-view />
        <agenday />
    `,
    styles: `
        :host {
            position: absolute;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        agenday {
            flex-grow: 1;
        }
    `,
})
export class AppComponent {

    private calendar = inject(CalendarService);

    today() {
        this.calendar.showDayRequest(new Date);
    }

}
