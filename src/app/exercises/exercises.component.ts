import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../core/components/confirm-dialog/confirm-dialog.component';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { Exercise, ExerciseEquipmentType, MuscleGroup, WarmupRampStep } from '../core/models/exercise.model';
import { exerciseWeightStep } from '../core/utils/weight-step.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../core/directives/select-on-focus.directive';
import { oneRepMaxOverrideChecked, oneRepMaxOverrideDisabled } from '../core/utils/one-rep-max.util';

const CUSTOM_ONE_REP_MAX_MIN = 0;
const CUSTOM_ONE_REP_MAX_MAX = 1000;

@Component({
  selector: 'app-exercises',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatSelectModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatDialogModule,
    TranslatePipe,
    SelectOnFocusDirective
  ],
  templateUrl: './exercises.component.html',
  styleUrl: './exercises.component.scss'
})
export class ExercisesComponent implements OnInit {
  exercises: Exercise[] = [];
  name = '';
  // Exercises created on this page open their panel when first rendered. Only
  // ever grows, so adding the next one doesn't collapse the earlier ones, and
  // collapsing one by hand isn't undone (the binding's value doesn't change).
  readonly autoExpandedExerciseIds = new Set<string>();
  // Exercise ids whose sourceImageUrl failed to load (blocked by an ad
  // blocker, offline, the source going down, ...) - falls back to the
  // built-in animated pictogram instead of a broken image.
  private readonly failedImageExerciseIds = new Set<string>();

  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly dialog: MatDialog
  ) {}

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.exercises = await this.exercisesService.getAll();
  }

  async addExercise(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    const created = await this.exercisesService.add({
      name: this.name.trim(),
      category: '',
      customOneRepMax: 0,
      useCustomOneRepMax: true
    });
    this.name = '';
    this.autoExpandedExerciseIds.add(created.id);
    await this.load();
    this.scrollToExercise(created.id);
  }

  // The list is sorted by name, so a new exercise lands somewhere in the
  // middle of it: bring it to the top of the view once its (already open) panel
  // has rendered. The panel's own top edge doesn't move while it expands.
  private scrollToExercise(id: string): void {
    setTimeout(() => {
      document.querySelector(`[data-exercise-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async updateWeightCategory(exercise: Exercise): Promise<void> {
    await this.exercisesService.update(exercise);
  }

  // The select's "No Assignment" option uses '' rather than null/undefined
  // as its value - mat-select comparing an option's value against undefined
  // (exercise.equipmentType when unset) doesn't reliably mark that option as
  // selected/displayed, so '' is used as an unambiguous sentinel instead and
  // converted back to undefined here before persisting.
  equipmentTypeValue(exercise: Exercise): ExerciseEquipmentType | '' {
    return exercise.equipmentType ?? '';
  }

  async updateEquipmentType(exercise: Exercise, value: ExerciseEquipmentType | ''): Promise<void> {
    exercise.equipmentType = value || undefined;
    await this.exercisesService.update(exercise);
  }

  // Same '' sentinel pattern as equipmentTypeValue/updateEquipmentType above.
  muscleGroupValue(exercise: Exercise): MuscleGroup | '' {
    return exercise.muscleGroup ?? '';
  }

  async updateMuscleGroup(exercise: Exercise, value: MuscleGroup | ''): Promise<void> {
    exercise.muscleGroup = value || undefined;
    await this.exercisesService.update(exercise);
  }

  async updateDoubleWeightCounting(exercise: Exercise, checked: boolean): Promise<void> {
    exercise.doubleWeightCounting = checked;
    await this.exercisesService.update(exercise);
  }

  // Copies the previous step's own percentage/reps, same convenience as
  // adding a set target row in the plan editor - only the very first step
  // falls back to a plain default.
  async addWarmupRampStep(exercise: Exercise): Promise<void> {
    const ramp = exercise.warmupRamp ?? [];
    const previous = ramp[ramp.length - 1];
    exercise.warmupRamp = [...ramp, { id: crypto.randomUUID(), percentage: previous?.percentage ?? 50, reps: previous?.reps ?? 5 }];
    await this.exercisesService.update(exercise);
  }

  async removeWarmupRampStep(exercise: Exercise, index: number): Promise<void> {
    exercise.warmupRamp = (exercise.warmupRamp ?? []).filter((_, i) => i !== index);
    await this.exercisesService.update(exercise);
  }

  warmupRampPercentageDisplay(step: WarmupRampStep): string {
    return step.percentage.toString();
  }

  // Up to 3 integer digits (bounded to 100 on change) and up to 2 decimals
  // while typing, same shape as the custom-1RM field's own input mask.
  onWarmupRampPercentageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateWarmupRampPercentage(exercise: Exercise, index: number, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const percentage = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : 0;
    exercise.warmupRamp = (exercise.warmupRamp ?? []).map((step, i) => (i === index ? { ...step, percentage } : step));
    await this.exercisesService.update(exercise);
  }

  warmupRampRepsDisplay(step: WarmupRampStep): string {
    return step.reps.toString();
  }

  onWarmupRampRepsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateWarmupRampReps(exercise: Exercise, index: number, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    const reps = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 999) : 0;
    exercise.warmupRamp = (exercise.warmupRamp ?? []).map((step, i) => (i === index ? { ...step, reps } : step));
    await this.exercisesService.update(exercise);
  }

  // Same idea as the warm-up ramp methods above, for the exercise's own
  // cooldown ramp instead.
  async addCooldownRampStep(exercise: Exercise): Promise<void> {
    const ramp = exercise.cooldownRamp ?? [];
    const previous = ramp[ramp.length - 1];
    exercise.cooldownRamp = [...ramp, { id: crypto.randomUUID(), percentage: previous?.percentage ?? 50, reps: previous?.reps ?? 5 }];
    await this.exercisesService.update(exercise);
  }

  async removeCooldownRampStep(exercise: Exercise, index: number): Promise<void> {
    exercise.cooldownRamp = (exercise.cooldownRamp ?? []).filter((_, i) => i !== index);
    await this.exercisesService.update(exercise);
  }

  cooldownRampPercentageDisplay(step: WarmupRampStep): string {
    return step.percentage.toString();
  }

  onCooldownRampPercentageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateCooldownRampPercentage(exercise: Exercise, index: number, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const percentage = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : 0;
    exercise.cooldownRamp = (exercise.cooldownRamp ?? []).map((step, i) => (i === index ? { ...step, percentage } : step));
    await this.exercisesService.update(exercise);
  }

  cooldownRampRepsDisplay(step: WarmupRampStep): string {
    return step.reps.toString();
  }

  onCooldownRampRepsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateCooldownRampReps(exercise: Exercise, index: number, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    const reps = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 999) : 0;
    exercise.cooldownRamp = (exercise.cooldownRamp ?? []).map((step, i) => (i === index ? { ...step, reps } : step));
    await this.exercisesService.update(exercise);
  }

  async updateDescription(exercise: Exercise, value: string): Promise<void> {
    exercise.description = value.trim() || undefined;
    await this.exercisesService.update(exercise);
  }

  hasWorkingSourceImage(exercise: Exercise): boolean {
    return !!exercise.sourceImageUrl && !this.failedImageExerciseIds.has(exercise.id);
  }

  onSourceImageError(exercise: Exercise): void {
    this.failedImageExerciseIds.add(exercise.id);
  }

  // The weight step field always shows the step in effect - the exercise's
  // own once entered, else the body-region default (2.5 upper / 5 lower).
  weightStepDisplay(exercise: Exercise): string {
    return exerciseWeightStep(exercise).toFixed(2);
  }

  // Same 4-integer/2-decimal mask as the other weight fields.
  onWeightStepFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Emptying the field or entering 0 goes back to the body-region default.
  async updateWeightStep(exercise: Exercise, input: HTMLInputElement): Promise<void> {
    const parsed = parseFloat(input.value.replace(',', '.'));
    exercise.weightStep = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 9999) : undefined;
    input.value = this.weightStepDisplay(exercise);
    await this.exercisesService.update(exercise);
  }

  customOneRepMaxDisplay(exercise: Exercise): string {
    return (exercise.customOneRepMax ?? 0).toString();
  }

  // Allows up to 4 integer digits (covers the 1000 upper bound) and up to
  // 2 decimal places while typing - final clamping to [0, 1000] happens in
  // updateCustomOneRepMax on change.
  onCustomOneRepMaxFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateCustomOneRepMax(exercise: Exercise, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    exercise.customOneRepMax = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, CUSTOM_ONE_REP_MAX_MIN), CUSTOM_ONE_REP_MAX_MAX)
      : 0;
    await this.exercisesService.update(exercise);
  }

  // Force-unchecked and disabled whenever no custom value has been entered
  // (0) but a real estimated 1RM already exists to fall back to - see
  // oneRepMaxOverrideChecked/Disabled in one-rep-max.util.
  useCustomOneRepMaxChecked(exercise: Exercise): boolean {
    return oneRepMaxOverrideChecked(exercise);
  }

  useCustomOneRepMaxDisabled(exercise: Exercise): boolean {
    return oneRepMaxOverrideDisabled(exercise);
  }

  async updateUseCustomOneRepMax(exercise: Exercise, useCustomOneRepMax: boolean): Promise<void> {
    exercise.useCustomOneRepMax = useCustomOneRepMax;
    await this.exercisesService.update(exercise);
  }

  // A modal, like the plans page: the header it was asked from is only one
  // row high and would clip an inline confirmation.
  async requestDeleteExercise(id: string): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { messageKey: 'exercises.confirmDeleteQuestion' }
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }
    await this.deleteExercise(id);
  }

  async deleteExercise(id: string): Promise<void> {
    await this.exercisesService.delete(id);
    await this.load();
  }
}
