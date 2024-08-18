import { Component, HostListener, Input, OnInit, Type, ElementRef, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

type CacheItem<Ins> = { index: number, inputs?: Ins };

@Component({
    selector: 'snap-proc-list',
    standalone: true,
    imports: [NgComponentOutlet],
    template: `
        @for (it of cached.slice(cachedOffset, cachedOffset+showCount*3);
              track it.index) {
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

    @Input({ required: true }) firstIndex!: number;
    @Input({ required: true }) showCount!: number;
    @Input({ required: true }) component!: Item;
    @Input({ required: true }) nthInputs!: (index: number) => Promise<Ins>;

    pageSize = 1;

    private el: HTMLElement = inject(ElementRef).nativeElement;

    ngOnInit() {
        this.init3Pages();
        setTimeout(() => {
            // FIXME: works but not a correct solution;
            // causes a flash with first rendering being 3x taller
            this.pageSize = this.el.offsetHeight/3;
            this.el.style.height = this.pageSize+'px';
            this.inPage = 0;
        });
    }

    // page managment stuff {{{
    // TODO: cache growth control (trim to size when too big)
    // private but used in template
    cached: CacheItem<Ins>[] = [];
    // private but used in template
    cachedOffset = 0;

    private make(index: number): CacheItem<Ins> {
        let it: CacheItem<Ins> = { index };
        this.nthInputs(index).then(r => it.inputs = r);
        return it;
    }

    private init3Pages() {
        for (let k = 0; k < this.showCount*3; ++k) {
            this.cached.push(this.make(this.firstIndex-1 -this.showCount + k));
        }
    }

    private _currentPage: number = 0;
    get currentPage(): number { return this._currentPage; }

    private previousPage() {
        --this._currentPage;
        if (this.cachedOffset < this.showCount) {
            for (let k = 0; k < this.showCount; ++k) {
                this.cached.unshift(this.make(this.firstIndex-1 +this.currentPage*this.showCount - k-1));
            }
        } else this.cachedOffset-= this.showCount;
    }

    private nextPage() {
        ++this._currentPage;
        this.cachedOffset+= this.showCount;
        if (this.cached.length < this.cachedOffset+this.showCount*3) {
            for (let k = 0; k < this.showCount; ++k) {
                this.cached.push(this.make(this.firstIndex-1 +(this.currentPage+1)*this.showCount + k));
            }
        }
    }
    // }}}

    // sub-page and scroll stuff {{{
    private _inPage: number = 0;
    get inPage(): number { return this._inPage; }
    private set inPage(value: number) {
        this._inPage = value;
        if (this.inPage < -.75) {
            this.previousPage();
            this.inPage+= 1;
        } else if (.75 < this.inPage) {
            this.nextPage();
            this.inPage-= 1;
        }

        this.el.scrollTop = this.currentScroll;
    }

    get currentScroll(): number { return (1+this.inPage) * this.pageSize; }

    snapTo(nthPage: number) {
        const fps = 60;
        // .25 is in seconds
        const step = 1 / (fps * .25);

        const timer = setInterval(() => {
            const diff = nthPage - (this.currentPage + this.inPage);
            if (-step < diff && diff < step) {
                clearInterval(timer);
                this.inPage = 0;
            } else this.inPage+= diff < 0 ? -step : step;
        }, 1000 / fps)
    }
    // }}}

    // pointer events stuff {{{
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
            this.inPage-= (ev.y-this.pointerLastY) / this.pageSize;
            this.pointerLastY = ev.y;
        }
    }

    @HostListener('window:pointerup', ['$event'])
    pointerup(ev: PointerEvent) {
        ev.preventDefault();
        delete this.pointerLastY;
        this.snapTo(this.currentPage);
    }
    // }}}

}
