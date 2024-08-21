import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { CalendarService, FilterAccuPipe, UserNote, UserNoteEdit } from './calendar.service';
import { CancelDoneDialogComponent } from './cancel-done-dialog.component';

@Component({
    selector: 'agenday',
    standalone: true,
    imports: [AsyncPipe, DatePipe, FilterAccuPipe, CancelDoneDialogComponent],
    template: `
        <h3>{{ day | date:'fullDate' }}</h3>
        @for (note of calendar.userNoteEdit$ | async | filterAccu:timeSt:timeEd;
              track $index) {
            <div>
                <p (click)='updateNote(note)'>{{ note.time | date:'shortTime' }} - {{ note.text }}
                    <button (click)='calendar.deleteUserNote(note)'>remove</button>
                </p>
            </div>
        }
        <button class=add (click)='createNote()'>add note</button>
        @if (editIntent) {
            <cancel-done-dialog
                [pass]=editIntent
                (onCancel)='dialogCancel()'
                (onDone)='dialogDone($event)'
            >
                <h4>{{ editIntent.isNew ? 'new note' : 'edit note' }}</h4>
                <label for=editTime>at this time</label>
                <input [value]=editIntentTimeTypeValue #editTime type=time />
            <br />
                <label for=editText>have note</label>
                <input [value]=editIntent.note.text placeholder='do something this day' #editText />
            <br />
                <label for=editMeta>(with metadata)</label>
                <input [value]=editIntent.note.meta #editMeta />
            </cancel-done-dialog>
        }
    `,
    styles: `
        :host {
            display: block;

            --paper-like: #f9f5d5;
            --ink-like: #a0a8b5;

            background: repeating-linear-gradient(0deg,
                var(--ink-like), var(--ink-like) 0px,
                var(--paper-like) 3px, var(--paper-like) 2rem);
        }

        h3 {
            font-size: 1.5rem;
            text-indent: 1.5rem;
        }

        p {
            text-indent: 1rem;
        }

        button.add {
            position: absolute;
            bottom: 50px;
            right: 50px;
        }
    `,
})
export class AgendayComponent {

    private _day: Date = new Date;
    get day(): Date { return this._day; }
    @Input() set day(value: Date | null) {
        if (value) this._day = new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate(),
        );
    }

    static MS_IN_DAY = 86400000;

    get timeSt() { return this.day.getTime(); }
    get timeEd() { return this.day.getTime() + AgendayComponent.MS_IN_DAY; }

    constructor(public calendar: CalendarService) {
        calendar.retrieveUserNotes(this.timeSt, this.timeEd);
    }

    editIntent?: { isNew: boolean, note: UserNote };
    @ViewChild('editTime') private editTime!: ElementRef;
    @ViewChild('editText') private editText!: ElementRef;
    @ViewChild('editMeta') private editMeta!: ElementRef;

    // see usage in template
    get editIntentTimeTypeValue(): string {
        const d = new Date(this.editIntent!.note.time);
        function two(d: number): string { return d < 10 ? '0'+d : ''+d; }
        return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
    }

    dialogCancel() { delete this.editIntent; }

    dialogDone(_pass: any) {
        const newNote: UserNote = {
            time: this.timeSt+this.editTime.nativeElement.valueAsNumber,
            text: this.editText.nativeElement.value,
            meta: this.editMeta.nativeElement.value,
        }

        if (newNote.time !== this.editIntent!.note.time) {
            this.calendar.deleteUserNote(this.editIntent!.note);
            this.calendar.updateUserNote(newNote);
        } else {
            if (this.editIntent!.isNew)
                this.calendar.createUserNote(newNote);
            else
                this.calendar.updateUserNote(newNote);
        }

        delete this.editIntent;
    }

    createNote() {
        this.editIntent = {
            isNew: true,
            note: {
                time: /*this.day.getTime() +*/ AgendayComponent.MS_IN_DAY/2,
                text: '',
                meta: '',
            },
        };
    }

    updateNote(existing: UserNote) {
        this.editIntent = {
            isNew: false,
            note: existing,
        };
    }

}
