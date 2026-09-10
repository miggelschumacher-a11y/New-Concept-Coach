import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface ConfirmDialogData {
  messageKey: string;
  // Every existing call site is a destructive delete-style confirmation, so
  // these default to that wording/color in the template - override them for
  // a non-destructive question (e.g. "finish the session?").
  confirmLabelKey?: string;
  cancelLabelKey?: string;
  confirmColor?: 'warn' | 'primary';
  // An already-resolved (not a translation key) line shown below the main
  // question - e.g. the session's last set's own progression/reduction
  // toast message, folded in here instead of shown as a separate popup.
  extraMessage?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslatePipe],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfirmDialogData
  ) {}
}
