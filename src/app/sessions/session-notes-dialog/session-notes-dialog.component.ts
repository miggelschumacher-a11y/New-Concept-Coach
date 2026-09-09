import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../../core/directives/select-on-focus.directive';

export interface SessionNotesDialogData {
  notes: string;
}

export interface SessionNotesDialogResult {
  notes: string;
}

const NOTES_MAX_LENGTH = 500;

@Component({
  selector: 'app-session-notes-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, SelectOnFocusDirective],
  templateUrl: './session-notes-dialog.component.html',
  styleUrl: './session-notes-dialog.component.scss'
})
export class SessionNotesDialogComponent {
  notes: string;
  readonly maxLength = NOTES_MAX_LENGTH;

  constructor(
    public readonly dialogRef: MatDialogRef<SessionNotesDialogComponent, SessionNotesDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: SessionNotesDialogData
  ) {
    this.notes = data.notes;
  }

  save(): void {
    this.dialogRef.close({ notes: this.notes });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
