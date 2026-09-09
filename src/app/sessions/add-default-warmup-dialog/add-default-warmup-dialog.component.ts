import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

export interface AddDefaultWarmupRow {
  exerciseId: string;
  exerciseName: string;
  // Own checkbox state - defaults to checked (data.rows is only ever built
  // from exercises that actually have a ramp, so opting in is the expected
  // choice; unchecking one row still lets the rest through on Apply).
  selected: boolean;
}

export interface AddDefaultWarmupDialogData {
  rows: AddDefaultWarmupRow[];
}

@Component({
  selector: 'app-add-default-warmup-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, TranslatePipe],
  templateUrl: './add-default-warmup-dialog.component.html',
  styleUrl: './add-default-warmup-dialog.component.scss'
})
export class AddDefaultWarmupDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<AddDefaultWarmupDialogComponent, string[] | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: AddDefaultWarmupDialogData
  ) {}

  // Applies the ramp to every still-checked row.
  confirm(): void {
    this.dialogRef.close(this.data.rows.filter((row) => row.selected).map((row) => row.exerciseId));
  }

  // No exercise gets its warm-up prefilled - same as if this dialog never
  // existed.
  skip(): void {
    this.dialogRef.close(undefined);
  }
}
