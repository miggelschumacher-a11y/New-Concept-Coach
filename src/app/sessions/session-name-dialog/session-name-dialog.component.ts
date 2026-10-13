import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../../core/directives/select-on-focus.directive';

export interface SessionNameDialogData {
  name: string;
}

@Component({
  selector: 'app-session-name-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, TranslatePipe, SelectOnFocusDirective],
  templateUrl: './session-name-dialog.component.html',
  styleUrl: './session-name-dialog.component.scss'
})
export class SessionNameDialogComponent {
  name: string;

  constructor(
    public readonly dialogRef: MatDialogRef<SessionNameDialogComponent, string | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: SessionNameDialogData
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
