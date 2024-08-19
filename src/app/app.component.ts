import { Component, inject } from '@angular/core';
import { CalendarService } from './calendar.service';
import { TopBarComponent } from './top-bar.component';
import { MonthViewComponent } from './month-view.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [TopBarComponent, MonthViewComponent],
    template: `
        <top-bar (click)=today() />
        <div>
            <month-view />
        </div>
    `,
    styles: `
        :host {
          --content-padding: 10px;
        }
    `,
})
export class AppComponent {

    private calendar = inject(CalendarService);

    today() {
        this.calendar.showDayRequest(new Date);
    }

}
