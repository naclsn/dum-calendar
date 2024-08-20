import { Component, HostListener, Input, Output, OnInit, OnDestroy, OnChanges, Type, ElementRef, inject, EventEmitter, SimpleChanges } from '@angular/core';
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
    ItemComponent extends Type<any>,
    ItemInputs extends Record<string, unknown> | undefined,
> implements OnInit, OnDestroy, OnChanges {

    @Input({ required: true }) component!: ItemComponent;
    @Input({ required: true }) firstIndex!: number;
    @Input({ required: true }) nthInputs!: (index: number) => { control: boolean, promise: Promise<ItemInputs> };

    @Input() snapToClosestNow: number | null = null;

    @Input() snapOffsetPx: number = 0;
    @Input() snapOffsetElm: number = 0;

    @Output() onVirtualScroll = new EventEmitter<{ visible: { inputs: ItemInputs }[] }>;

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

            // rem: see note on `this.pointerup`
            window.addEventListener('pointerup', this._pointerupListener, true);
        });
    }

    private _pointerupListener = this.pointerup.bind(this);
    ngOnDestroy(): void {
        window.removeEventListener('pointerup', this._pointerupListener, true);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ('snapToClosestNow' in changes && 'number' === typeof this.snapToClosestNow) {
            const to = this.snapToClosestNow;
            while (to < this.cached[0].index) this.loadToPreviousControl();
            while (this.cached[this.cached.length-1].index < to) this.loadToNextControl();

            const inCacheAt = to - this.cached[0].index;
            let control = inCacheAt;
            while (!this.cached[control].control) --control;
            this.snapToIndex(control);
        }
    }

    // page managment {{{
    // TODO: cache growth control (trim to size when too big)
    private cached: CacheItem<ItemInputs>[] = [];
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

    private loadNth(index: number): CacheItem<ItemInputs> {
        const { control, promise } = this.nthInputs(index);
        const it: CacheItem<ItemInputs> = { index, control };
        promise.then(inputs => it.inputs = inputs);
        return it;
    }

    private loadToPreviousControl() {
        let first: CacheItem<ItemInputs>;
        do {
            first = this.loadNth(this.cached[0].index-1);
            this.cached.unshift(first);
        } while (!first.control && this.cached.length < 500);
    }

    private loadToNextControl() {
        let last: CacheItem<ItemInputs>;
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
            const visible: { inputs: ItemInputs }[] = [];
            let k = this.previousGuardControl;
            while (this.el.children[++k].getBoundingClientRect().bottom < top);
            while (this.el.children[k].getBoundingClientRect().top < bottom)
                visible.push(this.renderedSlice[k++] as any);
            this.onVirtualScroll.emit({ visible });
        });
    }

    static FPS = 30;
    private _runningInterval?: number;
    // rem: interval returns true if it wants to continue, false to clear
    private runInterval(interval: () => boolean) {
        if (this._runningInterval) clearInterval(this._runningInterval);
        this._runningInterval = setInterval(() => {
            if (!interval()) {
                clearInterval(this._runningInterval);
                delete this._runningInterval;
            }
        }, 1000 / SnapProcList.FPS) as any;
    }

    snapToIndex(cachedControl: number) {
        const maybeRendered = cachedControl - this.cachedOffset;

        if (0 <= maybeRendered && maybeRendered < this.renderedCount)
            return this.snapToRendered(maybeRendered);

        // *x is in seconds
        const stepSize = this.el.offsetHeight / (SnapProcList.FPS * 0.125);

        this.runInterval(() => {
            const maybeRendered = cachedControl - this.cachedOffset;
            if (0 <= maybeRendered && maybeRendered < this.renderedCount)
                this.snapToRendered(cachedControl - this.cachedOffset);
            else
                this.virtualScroll+= maybeRendered < 0 ? -stepSize : stepSize;
            return true;
        });
    }

    snapToRendered(renderedControl: number) {
        // XXX/FIXME: prone OOB
        renderedControl+= this.snapOffsetElm;
        const targetRect = this.el.children[renderedControl].getBoundingClientRect();

        let scrollToCover = targetRect.top - this.el.getBoundingClientRect().top;
        scrollToCover+= this.snapOffsetPx;

        // *x is in seconds
        const stepSize = this.el.offsetHeight / (SnapProcList.FPS * .5);

        this.runInterval(() => {
            if (-stepSize < scrollToCover && scrollToCover < stepSize) {
                this.virtualScroll+= scrollToCover;
                return false;
            } else {
                const thisStep = scrollToCover < 0 ? -stepSize : stepSize;
                this.virtualScroll+= thisStep;
                scrollToCover-= thisStep;
                return true;
            }
        });
    }
    // }}}

    // pointer events {{{
    private pointerLastY?: number;
    private pointerInitialY?: number;

    @HostListener('pointerdown', ['$event'])
    poinderdown(ev: PointerEvent) {
        ev.preventDefault();
        this.pointerInitialY = this.pointerLastY = ev.y;
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

    // rem: added manually because needs to be capture phase
    //@HostListener('window:pointerup', ['$event'])
    pointerup(ev: PointerEvent) {
        const distance = ev.y - this.pointerInitialY!;
        if (distance < -30 || 30 < distance) {
            ev.preventDefault();
            ev.stopPropagation();
        }

        delete this.pointerLastY;
        delete this.pointerInitialY;


        let firstVisibleControl = this.previousGuardControl;
        const { top } = this.el.getBoundingClientRect();
        while (this.el.children[++firstVisibleControl].getBoundingClientRect().bottom < top);
        while (!this.renderedSlice[firstVisibleControl].control) ++firstVisibleControl;
        this.snapToRendered(firstVisibleControl);
    }
    // }}}

}
