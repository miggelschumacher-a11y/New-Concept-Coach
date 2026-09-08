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

// One drawn plate on the barbell diagram - a real plate, not a {weight,
// count} group, since each one needs its own x position along the sleeve.
export interface BarbellPlateRect {
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
}

export interface BarbellDiagram {
  width: number;
  height: number;
  barY: number;
  barThickness: number;
  barX1: number;
  barX2: number;
  leftPlates: BarbellPlateRect[];
  rightPlates: BarbellPlateRect[];
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

  // Fixed geometry (viewBox units) for the barbell diagram below.
  private readonly diagramWidth = 320;
  private readonly diagramHeight = 110;
  private readonly diagramCenterY = 55;
  private readonly barThickness = 6;
  private readonly barMargin = 8;
  private readonly gripHalfWidth = 26;
  private readonly sleeveMargin = 14;
  private readonly minPlateHeight = 24;
  private readonly maxPlateHeight = 90;
  private readonly minPlateThickness = 7;
  private readonly maxPlateThickness = 16;

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
  // or no plates needed), same guard the text breakdown itself uses.
  get barbellDiagram(): BarbellDiagram | null {
    const result = this.plateLoadingResult;
    if (result.perSide.length === 0) {
      return null;
    }
    const centerX = this.diagramWidth / 2;
    const sleeveLength = centerX - this.gripHalfWidth - this.sleeveMargin;
    const maxDiameter = Math.max(1, ...this.data.plates.map((plate) => plate.diameter || 0));
    const maxWeight = Math.max(1, ...result.perSide.map((item) => item.weight));

    // Expand each {weight, count} group (already heaviest-first, see
    // calculatePlateLoading) into individual plates, heaviest stacked
    // closest to the grip - matches how a real barbell is loaded.
    const plates: { weight: number; diameter: number; thickness: number }[] = [];
    for (const item of result.perSide) {
      const diameter = this.data.plates.find((plate) => plate.weight === item.weight)?.diameter || maxDiameter;
      const thickness =
        this.minPlateThickness + (this.maxPlateThickness - this.minPlateThickness) * (item.weight / maxWeight);
      for (let i = 0; i < item.count; i++) {
        plates.push({ weight: item.weight, diameter, thickness });
      }
    }

    // Shrinks every plate proportionally if the sleeve is too short to fit
    // them at their natural thickness, rather than letting them overflow
    // past the end of the bar.
    const totalThickness = plates.reduce((sum, plate) => sum + plate.thickness, 0);
    const scale = totalThickness > sleeveLength ? sleeveLength / totalThickness : 1;

    const buildSide = (direction: 1 | -1): BarbellPlateRect[] => {
      let offset = this.gripHalfWidth;
      return plates.map((plate) => {
        const width = plate.thickness * scale;
        const height = this.minPlateHeight + (this.maxPlateHeight - this.minPlateHeight) * (plate.diameter / maxDiameter);
        const x = direction === 1 ? centerX + offset : centerX - offset - width;
        offset += width;
        return { x, y: this.diagramCenterY - height / 2, width, height, weight: plate.weight };
      });
    };

    return {
      width: this.diagramWidth,
      height: this.diagramHeight,
      barY: this.diagramCenterY - this.barThickness / 2,
      barThickness: this.barThickness,
      barX1: this.barMargin,
      barX2: this.diagramWidth - this.barMargin,
      // Single-sided loading piles every plate onto one side (the right) -
      // the other side stays a bare bar, matching "Gewicht nur auf einer Seite".
      rightPlates: buildSide(1),
      leftPlates: this.singleSidedLoading ? [] : buildSide(-1)
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
