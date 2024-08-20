import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CalendarService {

    private showDay = new Subject<Date | null>;
    showDayRequest$ = this.showDay.asObservable();

    constructor() {
        setTimeout(() => this.showDayRequest(new Date));
    }

    showDayRequest(d: Date) {
        this.showDay.next(d);
    }

}
