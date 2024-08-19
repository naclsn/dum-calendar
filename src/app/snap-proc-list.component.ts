import { Component, HostListener, Input, Output, OnInit, Type, ElementRef, inject, EventEmitter } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

type CacheItem<Ins> = {
    index: number;
    control: boolean;
    inputs?: Ins;
};

@Component({
    selector: 'snap-proc-list',
    standalone: true,
    imports: [NgComponentOutlet],
    template: `
        @for (it of renderedSlice; track it.index) {
            <div>
                <ng-container *ngComponentOutlet="component; inputs: it.inputs" />
            </div>
        }
    `,
    styles: `
        :host {
            display: inline-block;
            overflow-y: hidden;
        }
    `,
    //changeDetection: ChangeDetectionStrategy.OnPush, //?
})
export class SnapProcList<
    Item extends Type<any>,
    Ins extends Record<string, unknown> | undefined,
> implements OnInit {

    @Input({ required: true }) component!: Item;
    @Input({ required: true }) firstIndex!: number;
    @Input({ required: true }) nthInputs!: (index: number) => { control: boolean, promise: Promise<Ins> };

    @Input() snapOffsetPx: number = 0;
    @Input() snapOffsetElm: number = 0;

    @Output() onVirtualScroll = new EventEmitter<{ visible: { inputs: Ins }[] }>;

    private el: HTMLElement = inject(ElementRef).nativeElement;

    ngOnInit() {
        // [ .. < ctrl .. ctrl .. {|ctrl .%.. ctrl }.. ctrl .. ctrl > .. ]
        //                ^prevguard                   ^nextguard
        //
        // [] cached   <> rendered   {} visible
        // | top (first visible)   % firstIndex
        //
        // guards are rendered-base indices

        // visible central 'page'
        const one = this.loadNth(this.firstIndex);
        this.cached.push(one);
        if (!one.control) this.loadToPreviousControl();
        this.loadToNextControl();
        const lengthWhenCtrlOneIsZero = this.cached.length;

        // previous to guard, then previous to control again
        this.loadToPreviousControl();
        const lengthWhenPrevGuardIsZero = this.cached.length;
        this.loadToPreviousControl();
        this.previousGuardControl = this.cached.length - lengthWhenPrevGuardIsZero;
        const ctrlOne = this.cached.length - lengthWhenCtrlOneIsZero + this.snapOffsetElm;

        // next to guard, then next to control again
        this.loadToNextControl();
        this.nextGuardControl = this.cached.length-1;
        this.loadToNextControl();

        this.renderedCount = this.cached.length;

        setTimeout(() => {
            const targetRect = this.el.children[ctrlOne].getBoundingClientRect();
            let scrollToCover = targetRect.top - this.el.getBoundingClientRect().top;
            scrollToCover+= this.snapOffsetPx;
            this.virtualScroll = scrollToCover;
        });
    }

    // page managment {{{
    // TODO: cache growth control (trim to size when too big)
    private cached: CacheItem<Ins>[] = [];
    private cachedOffset = 0;
    private renderedCount = 0;
    get renderedSlice() { return this.cached.slice(this.cachedOffset, this.cachedOffset+this.renderedCount); }

    previousGuardControl = 0;
    nextGuardControl = 0;

    get currentControl() {
        let r = this.previousGuardControl;
        while (!this.renderedSlice[++r].control);
        return r;
    }
    get adjacentControl() {
        let r = this.nextGuardControl;
        while (!this.renderedSlice[--r].control);
        return r;
    }
    //get currentControlInfo() { return this.renderedSlice[this.currentControl]; }

    private loadNth(index: number): CacheItem<Ins> {
        const { control, promise } = this.nthInputs(index);
        const it: CacheItem<Ins> = { index, control };
        promise.then(inputs => it.inputs = inputs);
        return it;
    }

    private loadToPreviousControl() {
        let first: CacheItem<Ins>;
        do {
            first = this.loadNth(this.cached[0].index-1);
            this.cached.unshift(first);
        } while (!first.control && this.cached.length < 500);
    }

    private loadToNextControl() {
        let last: CacheItem<Ins>;
        do {
            last = this.loadNth(this.cached[this.cached.length-1].index+1);
            this.cached.push(last);
        } while (!last.control && this.cached.length < 500);
    }

    private slideControlWindowPrevious() {
        // rem: -1 to keep the control
        this.renderedCount-= this.renderedCount - this.nextGuardControl -1;

        if (0 === this.cachedOffset) {
            const lengthWhenPrevGuardIsZero = this.cached.length;
            this.loadToPreviousControl();
            const addedCount = this.cached.length - lengthWhenPrevGuardIsZero;
            this.previousGuardControl = addedCount;
            this.renderedCount+= addedCount;
        } else {
            let addedCount = 0;
            while (!this.cached[--this.cachedOffset].control) ++addedCount;
            this.previousGuardControl = addedCount;
            this.renderedCount+= addedCount;
        }

        this.nextGuardControl = this.renderedCount-1;
        while (!this.renderedSlice[--this.nextGuardControl].control);

    }

    private slideControlWindowNext() {
        this.renderedCount-= this.previousGuardControl;
        this.cachedOffset+= this.previousGuardControl;

        this.previousGuardControl = 0;
        while (!this.renderedSlice[++this.previousGuardControl].control);

        this.nextGuardControl = this.renderedCount;
        if (this.cachedOffset + this.renderedCount === this.cached.length) {
            const oldLength = this.cached.length;
            this.loadToNextControl();
            this.renderedCount+= this.cached.length-oldLength;
        } else {
            while (!this.cached[this.cachedOffset + ++this.renderedCount].control);
            ++this.renderedCount;
        }
    }
    // }}}

    // virtual scroll {{{
    private _virtualScroll = 0;
    get virtualScroll() { return this._virtualScroll; }
    private set virtualScroll(value) {
        const delta = value - this._virtualScroll;
        this._virtualScroll = value;

        this.el.scrollTop+= delta;
        const { top, bottom } = this.el.getBoundingClientRect();

        const firstCtrlRect = this.el.children[this.previousGuardControl].getBoundingClientRect();
        if (top <= firstCtrlRect.bottom) this.slideControlWindowPrevious();

        const lastCtrlRect = this.el.children[this.nextGuardControl].getBoundingClientRect();
        if (lastCtrlRect.top <= bottom) this.slideControlWindowNext();

        // TODO: debounce
        setTimeout(() => {
            const visible: { inputs: Ins }[] = [];
            let k = this.previousGuardControl;
            while (this.el.children[++k].getBoundingClientRect().bottom < top);
            while (this.el.children[k].getBoundingClientRect().top < bottom)
                visible.push(this.renderedSlice[k++] as any);
            this.onVirtualScroll.emit({ visible });
        });
    }

    snapTo(control: number) {
        const FPS = 30;

        control+= this.snapOffsetElm;
        const targetRect = this.el.children[control].getBoundingClientRect();

        let scrollToCover = targetRect.top - this.el.getBoundingClientRect().top;
        scrollToCover+= this.snapOffsetPx;

        // *x is in seconds
        const stepSize = this.el.offsetHeight / (FPS * .5);

        const timer = setInterval(() => {
            if (-stepSize < scrollToCover && scrollToCover < stepSize) {
                clearInterval(timer);
                this.virtualScroll+= scrollToCover;
            } else {
                const thisStep = scrollToCover < 0 ? -stepSize : stepSize;
                this.virtualScroll+= thisStep;
                scrollToCover-= thisStep;
            }
        }, 1000 / FPS)
    }
    // }}}

    // pointer events {{{
    private pointerLastY?: number;

    @HostListener('pointerdown', ['$event'])
    poinderdown(ev: PointerEvent) {
        ev.preventDefault();
        this.pointerLastY = ev.y;
    }

    @HostListener('window:pointermove', ['$event'])
    pointermove(ev: PointerEvent) {
        if (this.pointerLastY) {
            ev.preventDefault();
            ev.stopPropagation();
            this.virtualScroll-= ev.y - this.pointerLastY;
            this.pointerLastY = ev.y;
        }
    }

    @HostListener('window:pointerup', ['$event'])
    pointerup(ev: PointerEvent) {
        // TODO maybe
        //if (50 < ev.y - this.pointerLastY!)
            ev.preventDefault();
        delete this.pointerLastY;


        let firstVisibleControl = this.previousGuardControl;
        const { top } = this.el.getBoundingClientRect();
        while (this.el.children[++firstVisibleControl].getBoundingClientRect().bottom < top);
        while (!this.renderedSlice[firstVisibleControl].control) ++firstVisibleControl;
        this.snapTo(firstVisibleControl);
    }
    // }}}

}
