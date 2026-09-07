import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../../core/directives/select-on-focus.directive';

export interface PlanStartingWeightRow {
  exerciseId: string;
  exerciseName: string;
  isPercentageBased: boolean;
  weight: number;
  // The exercise's current 1RM (own override if set, else estimated from
  // its last logged set) - shown next to its name for reference, since it's
  // what a Percentage-Based row's own weight is prefilled from.
  // oneRepMaxLabelKey is 'exercises.oneRepMaxCustom' or
  // 'exercises.oneRepMaxEstimated' depending on which one it is - same
  // convention as the Exercises page and session exercise headers.
  oneRepMax?: number;
  oneRepMaxLabelKey?: string;
  // Text buffer for the weight field, filled in by the dialog's own
  // ngOnInit - lets the field be typed into freely (matching every other
  // weight field in the app: up to 4 integer + 2 decimal digits while
  // typing, reformatted to trailing-zero form on blur) via a plain two-way
  // [(ngModel)], same proven pattern as the per-set weight field's own
  // fieldBuffer. Absent until the dialog sets it.
  weightText?: string;
}

export interface PlanStartingWeightsDialogData {
  rows: PlanStartingWeightRow[];
  weightUnitLabel: string;
}

@Component({
  selector: 'app-plan-starting-weights-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe,
    SelectOnFocusDirective
  ],
  templateUrl: './plan-starting-weights-dialog.component.html',
  styleUrl: './plan-starting-weights-dialog.component.scss'
})
export class PlanStartingWeightsDialogComponent implements OnInit {
  constructor(
    public readonly dialogRef: MatDialogRef<PlanStartingWeightsDialogComponent, PlanStartingWeightRow[] | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlanStartingWeightsDialogData
  ) {}

  ngOnInit(): void {
    for (const row of this.data.rows) {
      row.weightText = row.weight.toFixed(2);
    }
  }

  // Same digit limits as every other weight field in the app - up to 4
  // integer digits and 2 decimal places while typing.
  onWeightFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Parses the buffer into the row's real numeric weight and reformats the
  // field to trailing-zero form (e.g. "82.5" -> "82.50"), same as every
  // other weight field's blur behavior.
  onWeightFieldBlur(row: PlanStartingWeightRow): void {
    const parsed = parseFloat((row.weightText ?? '').replace(',', '.'));
    const weight = Number.isFinite(parsed) ? parsed : 0;
    row.weight = weight;
    row.weightText = weight.toFixed(2);
  }

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
