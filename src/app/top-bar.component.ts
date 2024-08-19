import { Component } from '@angular/core';

@Component({
    selector: 'top-bar',
    standalone: true,
    template: `
        <span class='title'>{{dayNow}}&nbsp;&nbsp;&nbsp;&nbsp;</span>
        <span class='icon'>&ograve;v&oacute;</span>
    `,
    styles: `
        :host {
            display: block;
            --height: 3rem;

            margin: var(--height);
            height: var(--height);

            background: var(--above-background);
            color: var(--above-foreground);

            box-shadow: 0px 2px 10px -4px var(--foreground);
            border-radius: calc(var(--height) / 2);

            padding: 0 calc(var(--height) / 2) 0 calc(var(--height) / 2);
        }

        .title {
            height: 100%;
            display: inline-block;
            font-size: calc(4 / 7 * var(--height));
            text-decoration: underline;
        }

        .icon {
            float: right;
            position: relative;
            top: 50%;
            transform: translateY(-50%);
        }
    `,
})
export class TopBarComponent {
    get dayNow(): string {
        const today = new Date();
        const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric' });
        return fmt.format(today);
    }
}
