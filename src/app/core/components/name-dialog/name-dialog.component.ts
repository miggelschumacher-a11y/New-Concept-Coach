import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { SelectOnFocusDirective } from '../../directives/select-on-focus.directive';

export interface NameDialogData {
  // Prefilled into the field ('' for none).
  name: string;
  // Translation key of the dialog's title.
  titleKey: string;
}

// Modal asking for a name (a new custom session or training plan): resolves
// with the trimmed, non-blank name on OK, or undefined on Cancel.
@Component({
  selector: 'app-name-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, SelectOnFocusDirective],
  templateUrl: './name-dialog.component.html',
  styleUrl: './name-dialog.component.scss'
})
export class NameDialogComponent {
  name: string;

  constructor(
    public readonly dialogRef: MatDialogRef<NameDialogComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: NameDialogData
  ) {
    this.name = data.name;
  }

  confirm(): void {
    const name = this.name.trim();
    if (name) {
      this.dialogRef.close(name);
    }
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
