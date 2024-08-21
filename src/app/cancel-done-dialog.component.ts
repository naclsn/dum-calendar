import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
    selector: 'cancel-done-dialog',
    standalone: true,
    template: `
        <div class=dialog (click)='$event.stopPropagation()'>
            <ng-content />
            <div class=buttons>
                <button (click)=cancel() >cancel</button>
                <button (click)=done() >done</button>
            </div>
        </div>
    `,
    styles: `
        :host {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #8888;
        }

        .dialog {
            display: block;
            min-height: 12rem;

            margin: 2rem;
            padding: 1rem;
            border-radius: 10px;

            background: var(--above-background);
            color: var(--above-foreground);

            box-shadow: 0px 2px 10px -4px var(--foreground);
        }

        .buttons {
            position: relative;
            top: 70%;
            left: 70%;
        }
    `,
})
export class CancelDoneDialogComponent<T> {

    @Input() pass?: T;

    @Output() onCancel = new EventEmitter<void>;
    @Output() onDone = new EventEmitter<T | undefined>;

    done() { this.onDone.emit(this.pass); }

    @HostListener('click')
    cancel() { this.onCancel.emit(); }

}
