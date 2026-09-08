import { Component, Inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../../core/directives/select-on-focus.directive';
import { DumbbellEntry } from '../../core/models/dumbbell-entry.model';
import { PlateEntry } from '../../core/models/plate-entry.model';
import { calculatePlateLoading, PlateLoadingResult } from '../../core/utils/plate-loading.util';

export interface SetEquipmentDialogData {
  weightText: string;
  weightUnitLabel: string;
  equipmentId?: string;
  doubleWeightCounting: boolean;
  singleSidedLoading: boolean;
  dumbbells: DumbbellEntry[];
  plates: PlateEntry[];
}

export interface SetEquipmentDialogResult {
  weight: number;
  equipmentId?: string;
  doubleWeightCounting: boolean;
  singleSidedLoading: boolean;
  // Set when the user picked one of the "copy to ..." buttons instead of
  // plain Save - SessionsComponent additionally propagates the weight to
  // the exercise's other sets, same as the reps/targetReps fields' own
  // copy popup (see applySetFieldCopy).
  copyTo?: 'incomplete' | 'all';
}

const EMPTY_PLATE_RESULT: PlateLoadingResult = { perSide: [], remainingPerSide: 0 };

@Component({
  selector: 'app-set-equipment-dialog',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule,
    TranslatePipe,
    SelectOnFocusDirective
  ],
  templateUrl: './set-equipment-dialog.component.html',
  styleUrl: './set-equipment-dialog.component.scss'
})
export class SetEquipmentDialogComponent {
  weightText: string;
  // null (not undefined) so it binds cleanly to a mat-option's [value]=null
  // "none selected" row.
  equipmentId: string | null;
  doubleWeightCounting: boolean;
  singleSidedLoading: boolean;
  // Mutually exclusive - "all sets" is a superset of "incomplete sets", so
  // checking one clears the other (see onCopyToIncompleteChange/
  // onCopyToAllChange) rather than leaving an ambiguous combination for
  // save() to resolve.
  copyToIncomplete = false;
  copyToAll = false;

  constructor(
    public readonly dialogRef: MatDialogRef<SetEquipmentDialogComponent, SetEquipmentDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public readonly data: SetEquipmentDialogData
  ) {
    this.weightText = data.weightText;
    this.equipmentId = data.equipmentId ?? null;
    this.doubleWeightCounting = data.doubleWeightCounting;
    this.singleSidedLoading = data.singleSidedLoading;
  }

  // Same 4-int/2-decimal mask as every other weight field in the app.
  onWeightFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.weightText = input.value;
  }

  onWeightFieldBlur(): void {
    const parsed = parseFloat(this.weightText.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      this.weightText = parsed.toFixed(2);
    }
  }

  get selectedEquipment(): DumbbellEntry | undefined {
    return this.equipmentId ? this.data.dumbbells.find((entry) => entry.id === this.equipmentId) : undefined;
  }

  // Recomputed live off the current weight text and selected equipment's
  // own weight - see calculatePlateLoading (core/utils/plate-loading.util).
  get plateLoadingResult(): PlateLoadingResult {
    const equipment = this.selectedEquipment;
    const target = parseFloat(this.weightText.replace(',', '.'));
    if (!equipment || !Number.isFinite(target)) {
      return EMPTY_PLATE_RESULT;
    }
    return calculatePlateLoading(target, equipment.weight, this.data.plates, this.singleSidedLoading);
  }

  onCopyToIncompleteChange(checked: boolean): void {
    this.copyToIncomplete = checked;
    if (checked) {
      this.copyToAll = false;
    }
  }

  onCopyToAllChange(checked: boolean): void {
    this.copyToAll = checked;
    if (checked) {
      this.copyToIncomplete = false;
    }
  }

  save(): void {
    const copyTo = this.copyToAll ? 'all' : this.copyToIncomplete ? 'incomplete' : undefined;
    const parsed = parseFloat(this.weightText.replace(',', '.'));
    this.dialogRef.close({
      weight: Number.isFinite(parsed) ? parsed : 0,
      equipmentId: this.equipmentId ?? undefined,
      doubleWeightCounting: this.doubleWeightCounting,
      singleSidedLoading: this.singleSidedLoading,
      copyTo
    });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
