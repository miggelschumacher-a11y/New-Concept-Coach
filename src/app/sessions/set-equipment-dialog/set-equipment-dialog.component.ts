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
  fill: string;
  stroke: string;
}

// One label per physical plate, centered on that plate's own rect.
export interface BarbellPlateLabel {
  x: number;
  y: number;
  text: string;
  // Contrasts with the plate's own fill (see PlateColor.isLight) - a plain
  // white label is unreadable on a light plate like the 5 KG white disk.
  fill: string;
}

export interface PlateColor {
  fill: string;
  isLight: boolean;
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
  // Real-world IPF/IWF plate color convention (KG values) - a custom
  // inventory entry whose weight doesn't match one of these exactly falls
  // back to FALLBACK_PLATE_COLORS instead, so it still gets a distinct
  // color rather than none at all.
  private static readonly STANDARD_PLATE_COLORS: ReadonlyArray<{ weight: number; color: string }> = [
    { weight: 25, color: '#d32f2f' },
    { weight: 20, color: '#1e88e5' },
    { weight: 15, color: '#fbc02d' },
    { weight: 10, color: '#43a047' },
    { weight: 5, color: '#f5f5f5' },
    { weight: 2.5, color: '#212121' },
    { weight: 1.25, color: '#b0bec5' }
  ];

  // Cycled heaviest-first for any plate weight that isn't one of the
  // standard sizes above.
  private static readonly FALLBACK_PLATE_COLORS: ReadonlyArray<string> = [
    '#5c6bc0',
    '#8e24aa',
    '#fb8c00',
    '#00897b',
    '#6d4c41',
    '#c0ca33'
  ];

  private static isLightColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  }

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
  // Visible gap between adjacent physical plates, same idea as the real
  // disks not sitting flush against each other on the bar.
  private readonly plateGap = 2;

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

  // One color per distinct plate weight, shared between the SVG diagram and
  // the text list below it so the same weight always reads as the same
  // color in both places (see STANDARD_PLATE_COLORS/FALLBACK_PLATE_COLORS).
  get plateColorMap(): Map<number, PlateColor> {
    const map = new Map<number, PlateColor>();
    const weights = [...new Set(this.plateLoadingResult.perSide.map((item) => item.weight))].sort((a, b) => b - a);
    let fallbackIndex = 0;
    for (const weight of weights) {
      const standard = SetEquipmentDialogComponent.STANDARD_PLATE_COLORS.find((entry) => Math.abs(entry.weight - weight) < 0.01);
      const fill = standard?.color ?? SetEquipmentDialogComponent.FALLBACK_PLATE_COLORS[fallbackIndex++ % SetEquipmentDialogComponent.FALLBACK_PLATE_COLORS.length];
      map.set(weight, { fill, isLight: SetEquipmentDialogComponent.isLightColor(fill) });
    }
    return map;
  }

  // Sanity-check line beneath the breakdown - equipment weight plus what's
  // actually loaded (not the raw target), so it stays honest about what
  // this really adds up to whenever a remainder is shown above.
  get plateSummaryLine(): string | null {
    const equipment = this.selectedEquipment;
    const result = this.plateLoadingResult;
    if (!equipment || result.perSide.length === 0) {
      return null;
    }
    const unit = this.data.weightUnitLabel;
    const perSideTotal = result.perSide.reduce((sum, item) => sum + item.weight * item.count, 0);
    const sides = this.singleSidedLoading ? 1 : 2;
    const total = equipment.weight + perSideTotal * sides;
    const platesPart = sides === 2 ? `2 × ${perSideTotal.toFixed(2)} ${unit}` : `${perSideTotal.toFixed(2)} ${unit}`;
    return `${equipment.name} (${equipment.weight.toFixed(2)} ${unit}) + ${platesPart} = ${total.toFixed(2)} ${unit}`;
  }

  // Renders plateLoadingResult as an actual loaded barbell rather than just
  // a text list - null when there's nothing to draw (no equipment picked
  // or no plates needed), same guard the text breakdown itself uses. Only
  // one side is drawn (this popup's field is already "per side"); sorted
  // lightest-first and placed starting at x=0 (the outer end of the bar)
  // so the lightest plates end up at that end and the heaviest end up
  // closest to the middle of the bar.
  get barbellDiagram(): BarbellDiagram | null {
    const result = this.plateLoadingResult;
    if (result.perSide.length === 0) {
      return null;
    }
    const sleeveLength = this.diagramWidth - this.startMargin - this.endMargin;
    // Scaled against only the plates actually drawn here, not every plate
    // weight in the equipment master data (Config > Ausrüstung > Scheiben) -
    // scaling against the full inventory made every plate in a lighter
    // breakdown collapse to the same minPlateHeight floor whenever the user
    // owned even one much heavier plate elsewhere that this breakdown didn't
    // need, defeating the whole point of a proportional drawing. Comparing
    // sizes across two different popups is far less useful than each one
    // correctly showing its own plates' relative sizes.
    const maxWeight = Math.max(1, ...result.perSide.map((item) => item.weight));
    const colorMap = this.plateColorMap;
    const fallbackColor: PlateColor = { fill: SetEquipmentDialogComponent.FALLBACK_PLATE_COLORS[0], isLight: false };

    const groups = [...result.perSide]
      .sort((a, b) => a.weight - b.weight)
      .map((item) => {
        const perPlateThickness =
          this.minPlateThickness + (this.maxPlateThickness - this.minPlateThickness) * Math.sqrt(item.weight / maxWeight);
        return { weight: item.weight, count: item.count, perPlateThickness, color: colorMap.get(item.weight) ?? fallbackColor };
      });

    // Shrinks every plate proportionally if the sleeve is too short to fit
    // them (plus the gaps between them) at their natural thickness, rather
    // than letting them overflow past the end of the bar.
    const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
    const totalGapSpace = totalCount > 1 ? (totalCount - 1) * this.plateGap : 0;
    const availableForPlates = Math.max(0, sleeveLength - totalGapSpace);
    const totalThickness = groups.reduce((sum, group) => sum + group.perPlateThickness * group.count, 0);
    const scale = totalThickness > availableForPlates ? availableForPlates / totalThickness : 1;

    let offset = this.startMargin;
    let plateIndex = 0;
    const plates: BarbellPlateRect[] = [];
    const labels: BarbellPlateLabel[] = [];
    for (const group of groups) {
      const width = group.perPlateThickness * scale;
      // Square-root (not linear) scaling: a purely linear scale maps most
      // of a breakdown's real weight spread into a sliver just above
      // minPlateHeight whenever one plate (here, the heaviest one actually
      // drawn) is far heavier than the rest - e.g. 0.5/1.25/5/20 KG all but
      // the 20 would round-trip to the exact same floored height. Square
      // root spreads the lighter end out instead, roughly tracking how a
      // real plate's size grows with its weight (radius/thickness both
      // increase together, so size grows slower than weight) - never
      // actually reaches 0, so no artificial floor is needed either. Weight
      // (not the configured diameter) drives this so the visual size always
      // tracks what the plate actually is, even when several plates share
      // the same diameter.
      const height = this.minPlateHeight + (this.maxPlateHeight - this.minPlateHeight) * Math.sqrt(group.weight / maxWeight);
      const stroke = group.color.isLight ? '#616161' : 'rgba(0, 0, 0, 0.35)';
      const labelFill = group.color.isLight ? '#212121' : '#ffffff';
      for (let i = 0; i < group.count; i++) {
        if (plateIndex > 0) {
          offset += this.plateGap;
        }
        const x = offset;
        plates.push({ x, y: this.diagramCenterY - height / 2, width, height, weight: group.weight, fill: group.color.fill, stroke });
        labels.push({ x: x + width / 2, y: this.diagramCenterY, text: group.weight.toFixed(2), fill: labelFill });
        offset += width;
        plateIndex++;
      }
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
