import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CalendarService {

    private showDay = new Subject<Date>;
    showDayRequest$ = this.showDay.asObservable();

    showDayRequest(n: Date) {
        this.showDay.next(n);
    }

}
