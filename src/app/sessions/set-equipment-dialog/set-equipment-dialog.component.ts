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

// One drawn rect per physical plate (not merged per weight) - a stack of
// e.g. two 5.00 KG plates draws as two adjacent rects with a visible seam
// between them, same as the real disks on a bar.
export interface BarbellPlateRect {
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
}

// One label per distinct weight group, centered over that group's full run
// of plates - avoids repeating the same value once per physical plate.
export interface BarbellPlateLabel {
  x: number;
  y: number;
  text: string;
}

export interface BarbellDiagram {
  width: number;
  height: number;
  barY: number;
  barThickness: number;
  barX1: number;
  barX2: number;
  plates: BarbellPlateRect[];
  labels: BarbellPlateLabel[];
}

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

  // Fixed geometry (viewBox units) for the barbell diagram below - only one
  // side is drawn (see barbellDiagram), since the other side of a
  // symmetrically-loaded bar is identical and single-sided loading has no
  // second side to begin with.
  private readonly diagramWidth = 200;
  private readonly diagramHeight = 110;
  private readonly diagramCenterY = 70;
  private readonly barThickness = 6;
  private readonly startMargin = 4;
  private readonly endMargin = 10;
  private readonly minPlateHeight = 26;
  private readonly maxPlateHeight = 70;
  private readonly minPlateThickness = 10;
  private readonly maxPlateThickness = 22;

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

  // Renders plateLoadingResult as an actual loaded barbell rather than just
  // a text list - null when there's nothing to draw (no equipment picked
  // or no plates needed), same guard the text breakdown itself uses. Only
  // one side is drawn (this popup's field is already "per side"), heaviest
  // plate closest to x=0 (the grip end, off-diagram) same as a real bar.
  get barbellDiagram(): BarbellDiagram | null {
    const result = this.plateLoadingResult;
    if (result.perSide.length === 0) {
      return null;
    }
    const sleeveLength = this.diagramWidth - this.startMargin - this.endMargin;
    const maxDiameter = Math.max(1, ...this.data.plates.map((plate) => plate.diameter || 0));
    const maxWeight = Math.max(1, ...result.perSide.map((item) => item.weight));

    const groups = result.perSide.map((item) => {
      const diameter = this.data.plates.find((plate) => plate.weight === item.weight)?.diameter || maxDiameter;
      const perPlateThickness =
        this.minPlateThickness + (this.maxPlateThickness - this.minPlateThickness) * (item.weight / maxWeight);
      return { weight: item.weight, diameter, count: item.count, perPlateThickness };
    });

    // Shrinks every plate proportionally if the sleeve is too short to fit
    // them at their natural thickness, rather than letting them overflow
    // past the end of the bar.
    const totalThickness = groups.reduce((sum, group) => sum + group.perPlateThickness * group.count, 0);
    const scale = totalThickness > sleeveLength ? sleeveLength / totalThickness : 1;

    let offset = this.startMargin;
    const plates: BarbellPlateRect[] = [];
    const labels: BarbellPlateLabel[] = [];
    for (const group of groups) {
      const width = group.perPlateThickness * scale;
      // True proportional sizing (height scales linearly with diameter, no
      // min/max blending) so e.g. a plate with 2/3 the diameter of the
      // largest one on hand actually draws at 2/3 the height - a floor
      // keeps very small plates from disappearing entirely.
      const height = Math.max(this.minPlateHeight, (group.diameter / maxDiameter) * this.maxPlateHeight);
      const groupStartX = offset;
      for (let i = 0; i < group.count; i++) {
        plates.push({ x: offset, y: this.diagramCenterY - height / 2, width, height, weight: group.weight });
        offset += width;
      }
      labels.push({
        x: (groupStartX + offset) / 2,
        y: this.diagramCenterY - height / 2 - 6,
        text: group.weight.toFixed(2)
      });
    }

    return {
      width: this.diagramWidth,
      height: this.diagramHeight,
      barY: this.diagramCenterY - this.barThickness / 2,
      barThickness: this.barThickness,
      barX1: 0,
      barX2: this.diagramWidth,
      plates,
      labels
    };
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
