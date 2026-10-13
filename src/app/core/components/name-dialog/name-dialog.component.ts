import { Component, Inject } from '@angular/core';
import { AbstractControl, FormControl, FormsModule, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { SelectOnFocusDirective } from '../../directives/select-on-focus.directive';
import { isNameTaken } from '../../utils/unique-name.util';

export interface NameDialogData {
  // Prefilled into the field ('' for none).
  name: string;
  // Translation key of the dialog's title.
  titleKey: string;
  // Names already in use: a name matching one of them (ignoring case and
  // surrounding blanks) is rejected, with the message under takenMessageKey.
  takenNames?: string[];
  takenMessageKey?: string;
}

// Flags only the "taken" error, so a blank field just keeps OK disabled
// without turning red.
const takenErrorMatcher: ErrorStateMatcher = {
  isErrorState: (control) => !!control && control.hasError('taken')
};

// Modal asking for a name (a new custom session or training plan): resolves
// with the trimmed, non-blank, not-yet-taken name on OK, or undefined on
// Cancel.
@Component({
  selector: 'app-name-dialog',
  standalone: true,
  // FormsModule provides the <form>'s ngSubmit; ReactiveFormsModule the formControl.
  imports: [FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, SelectOnFocusDirective],
  templateUrl: './name-dialog.component.html',
  styleUrl: './name-dialog.component.scss'
})
export class NameDialogComponent {
  readonly takenErrorMatcher = takenErrorMatcher;
  readonly nameControl: FormControl<string>;

  constructor(
    public readonly dialogRef: MatDialogRef<NameDialogComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: NameDialogData
  ) {
    this.nameControl = new FormControl(data.name, {
      nonNullable: true,
      validators: [
        (control: AbstractControl<string>): ValidationErrors | null =>
          isNameTaken(control.value, data.takenNames ?? []) ? { taken: true } : null
      ]
    });
  }

  get canConfirm(): boolean {
    return this.nameControl.valid && !!this.nameControl.value.trim();
  }

  confirm(): void {
    if (this.canConfirm) {
      this.dialogRef.close(this.nameControl.value.trim());
    }
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
