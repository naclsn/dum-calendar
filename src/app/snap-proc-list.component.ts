import { Component, Input, OnInit, Type } from '@angular/core';
import { NgComponentOutlet, NgFor } from '@angular/common';

@Component({
    selector: 'snap-proc-list',
    standalone: true,
    imports: [NgComponentOutlet, NgFor],
    template: `
        <div *ngFor="let inputs of ins">
            <ng-container *ngComponentOutlet="component; inputs: inputs" />
        </div>
    `,
    styles: ``
})
export class SnapProcList<
    T extends Type<any>,
    Ins extends Record<string, unknown> | undefined,
> implements OnInit {
    @Input({ required: true }) first_index!: number;
    @Input({ required: true }) show_count!: number;
    @Input({ required: true }) component!: T;
    @Input({ required: true }) nth_inputs!: (index: number) => Ins;

    ins: Ins[] = [];
    ins_off = 0;

    ngOnInit() {
        for (let k = 0; k < this.show_count; ++k) {
            this.ins[k] = this.nth_inputs(this.first_index + k);
        }
    }
}
