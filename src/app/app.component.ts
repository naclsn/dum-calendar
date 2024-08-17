import { Component } from '@angular/core';
import { MonthViewComponent } from './month-view.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [MonthViewComponent],
    template: `
        <h1>hewwo</h1>
        <month-view></month-view>
    `,
    styles: `
        :host {
          --content-padding: 10px;
        }

        header {
          display: block;
          height: 60px;
          padding: var(--content-padding);
        }

        .content {
          padding: var(--content-padding);
        }
    `,
})
export class AppComponent {

}
