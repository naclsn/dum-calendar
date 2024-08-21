import { Injectable, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subject } from 'rxjs';

export type UserNote = {
    time: number; // rem: Date.getTime(), is unique (no 2 notes with the same time)
    text: string;
    meta: string;
};

export type UserNoteEdit = {
    kind: 'created' | 'retrieved' | 'updated' | 'deleted';
    note: UserNote;
};

/// helper pipe to filter notes in a time frame (may be considered pure from Angular's point of view) {{{
@Pipe({
    name: 'filterAccu',
    standalone: true,
    //pure: false,
})
export class FilterAccuPipe implements PipeTransform {

    private list: UserNote[] = [];
    private timeSt: number = 0;
    private timeEd: number = 0;

    transform(edit: UserNoteEdit | null, timeSt: number, timeEd: number): UserNote[] {
        if (this.timeSt !== timeSt || this.timeEd !== timeEd) {
            this.timeSt = timeSt;
            this.timeEd = timeEd;

            if (this.list.length) {
                let broke;
                // remove all that's before `timeSt`
                for (let k = 0; k < this.list.length; ++k) {
                    if (timeSt <= this.list[k].time) {
                        this.list.splice(0, k);
                        broke = true;
                        break;
                    }
                }
                // if didn't reach 'break' then all are before
                if (!broke) this.list.length = 0;
                // else keep only all that's before `timeEd`
                else for (let k = 0; k < this.list.length; ++k) {
                    if (timeEd <= this.list[k].time) {
                        this.list.splice(k);
                        break;
                    }
                }
            }
        } // if time range changed

        if (edit) {
            const time = edit.note.time;
            if (time < timeSt || timeEd <= time) return this.list;
            let needsSort = false;

            switch (edit.kind) {
            case 'created':
                this.list.push(edit.note);
                needsSort = true;
                break;

            case 'retrieved':
            case 'updated':
                for (let k = 0; k < this.list.length; ++k) if (time === this.list[k].time) {
                    this.list[k] = edit.note;
                    needsSort = true;
                    break;
                }
                if (!needsSort) {
                    this.list.push(edit.note);
                    needsSort = true;
                }
                break;

            case 'deleted':
                for (let k = 0; k < this.list.length; ++k) if (time === this.list[k].time) {
                    this.list.splice(k, 1);
                    // rem: not marked because already sorted
                    break;
                }
                break;
            }

            if (needsSort) this.list.sort((a, b) => a.time - b.time);
        } // if null != edit

        return this.list;
    }

}
// }}}

@Injectable({
    providedIn: 'root',
})
export class CalendarService implements OnDestroy {

    private db?: IDBDatabase;

    private showDay = new Subject<Date | null>;
    showDayRequest$ = this.showDay.asObservable();

    private userNote = new Subject<UserNoteEdit>;
    userNoteEdit$ = this.userNote.asObservable();

    constructor() {
        //const req = window.indexedDB.open('calenglar');
        //req.onsuccess = _ => this.db = req.result;
        //req.onupgradeneeded = _ => {
        //    const store = req.result.createObjectStore('notes', { keyPath: 'time' });
        //    store.transaction.oncomplete = _ => this.db = req.result;
        //};
        //req.onblocked = w => console.warn(w);
        //req.onerror = e => console.error(e);

        setTimeout(() => this.showDayRequest(new Date), 1000);
    }

    ngOnDestroy(): void {
        this.db?.close();
    }

    showDayRequest(d: Date) {
        this.showDay.next(d);
    }

    createUserNote(note: UserNote) {
        if (!this.db) this.userNote.next({ kind: 'created', note });
        else this.db.transaction('notes', 'readwrite').objectStore('notes').add(note).onsuccess = _ => this.userNote.next({ kind: 'created', note });
    }

    updateUserNote(note: UserNote) {
        if (!this.db) this.userNote.next({ kind: 'updated', note });
        else this.db.transaction('notes', 'readwrite').objectStore('notes').put(note).onsuccess = _ => this.userNote.next({ kind: 'created', note });
    }

    deleteUserNote(note: UserNote) {
        if (!this.db) this.userNote.next({ kind: 'deleted', note });
        else this.db.transaction('notes', 'readwrite').objectStore('notes').delete(note.time).onsuccess = _ => this.userNote.next({ kind: 'created', note });
    }

    retrieveUserNotes(since: number, until: number) {
        if (!this.db) return;
        debugger; // TODO
        // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#using_a_cursor
    }

}
