import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

export interface PlanStartingWeightRow {
  exerciseId: string;
  exerciseName: string;
  isPercentageBased: boolean;
  weight: number;
}

export interface PlanStartingWeightsDialogData {
  rows: PlanStartingWeightRow[];
  weightUnitLabel: string;
}

@Component({
  selector: 'app-plan-starting-weights-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './plan-starting-weights-dialog.component.html',
  styleUrl: './plan-starting-weights-dialog.component.scss'
})
export class PlanStartingWeightsDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<PlanStartingWeightsDialogComponent, PlanStartingWeightRow[] | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlanStartingWeightsDialogData
  ) {}

  // Applies every row's (possibly edited) weight.
  confirm(): void {
    this.dialogRef.close(this.data.rows);
  }

  // No override applied at all - every exercise is created exactly as
  // "Create from Plan" would without this dialog existing.
  skip(): void {
    this.dialogRef.close(undefined);
  }
}
