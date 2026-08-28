import { Component, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../core/components/confirm-dialog/confirm-dialog.component';
import { TrainingPlansService } from '../core/services/training-plans.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { TranslationService } from '../core/services/translation.service';
import {
  TrainingPlan,
  TierLinePlanExercise,
  PlanExerciseConfig,
  PlanExerciseType,
  PercentageWeek
} from '../core/models/training-plan.model';
import { Exercise } from '../core/models/exercise.model';
import { GzclTier, TrainingMethodology } from '../core/models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from '../core/utils/tier-line-progression.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { DEFAULT_5X5_PLAN_ID } from '../core/data/default-5x5-plan';
import { DEFAULT_531_PLAN_ID } from '../core/data/default-531-plan';
import { DEFAULT_GZCLP_PLAN_ID } from '../core/data/default-gzclp-plan';
import { DEFAULT_GREYSKULL_PLAN_ID } from '../core/data/default-greyskull-plan';
import { DEFAULT_NSUNS_PLAN_ID } from '../core/data/default-nsuns-plan';
import { DEFAULT_HEAVYDUTY_PLAN_ID } from '../core/data/default-heavyduty-plan';

const DEFAULT_PLAN_DESCRIPTION_KEYS: Record<string, string> = {
  [DEFAULT_531_PLAN_ID]: 'trainingPlans.plan531Description',
  [DEFAULT_5X5_PLAN_ID]: 'trainingPlans.plan5x5Description',
  [DEFAULT_GZCLP_PLAN_ID]: 'trainingPlans.planGzclpDescription',
  [DEFAULT_NSUNS_PLAN_ID]: 'trainingPlans.planNsunsDescription',
  [DEFAULT_GREYSKULL_PLAN_ID]: 'trainingPlans.planGreyskullDescription',
  [DEFAULT_HEAVYDUTY_PLAN_ID]: 'trainingPlans.planHeavyDutyDescription'
};

const DEFAULT_WARMUP_SETS = 0;
const DEFAULT_WORKING_SETS = 3;
const DEFAULT_COOLDOWN_SETS = 0;
const PLAN_EXERCISE_SETS_MAX = 100;
const DEFAULT_EXERCISE_TYPE: PlanExerciseType = 'WEIGHT_BASED';

// Classic Wendler 5/3/1: 3 waves building to a heavier AMRAP top set, then a
// deload week. Seeded the first time an exercise is switched to
// percentage-based, so there's a working example to edit instead of nothing.
const DEFAULT_PERCENTAGE_WEEKS: PercentageWeek[] = [
  {
    sets: [
      { percentage: 65, reps: 5, isAmrap: false },
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 5, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 70, reps: 3, isAmrap: false },
      { percentage: 80, reps: 3, isAmrap: false },
      { percentage: 90, reps: 3, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 3, isAmrap: false },
      { percentage: 95, reps: 1, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 40, reps: 5, isAmrap: false },
      { percentage: 50, reps: 5, isAmrap: false },
      { percentage: 60, reps: 5, isAmrap: false }
    ]
  }
];

@Component({
  selector: 'app-training-plans',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatExpansionModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatDialogModule,
    NgTemplateOutlet,
    TranslatePipe
  ],
  templateUrl: './training-plans.component.html',
  styleUrl: './training-plans.component.scss'
})
export class TrainingPlansComponent implements OnInit {
  plans: TrainingPlan[] = [];
  exercises: Exercise[] = [];
  name = '';
  description = '';
  editingPlanId: string | null = null;
  editName = '';
  editDescription = '';

  constructor(
    private readonly trainingPlansService: TrainingPlansService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly translationService: TranslationService,
    private readonly dialog: MatDialog
  ) {}

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    [this.plans, this.exercises] = await Promise.all([
      this.trainingPlansService.getAll(),
      this.exercisesService.getAll()
    ]);
  }

  exerciseName(exerciseId: string): string {
    return this.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? '';
  }

  // The seeded default plan's description is generated text, not user input,
  // so it should track the current language live like the rest of the UI
  // instead of being frozen in whatever language it was seeded in.
  planDescription(plan: TrainingPlan): string {
    const key = DEFAULT_PLAN_DESCRIPTION_KEYS[plan.id];
    return key ? this.translationService.translate(key) : plan.description ?? '';
  }

  tierLabelKey(tier: string): string {
    return 'trainingPlans.tier' + tier.split('_')[0];
  }

  setNumbers(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  isTierLineProgressionExercise(plan: TrainingPlan, planExercise: TierLinePlanExercise): boolean {
    return plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION && !!planExercise;
  }

  tierLineWeightIncrement(exerciseId: string): number {
    const category = this.exercises.find((exercise) => exercise.id === exerciseId)?.weightCategory ?? 'UPPER_BODY';
    return WEIGHT_INCREMENT_BY_EXERCISE_TYPE[category];
  }

  setValueDisplay(planExercise: TierLinePlanExercise, setNumber: number): string {
    const isLastSet = setNumber === planExercise.sets;
    const isAmrapTier = planExercise.tier === GzclTier.T1_MAIN || planExercise.tier === GzclTier.T3_ACCESSORY;
    return isLastSet && isAmrapTier ? `${planExercise.targetReps}+` : `${planExercise.targetReps}`;
  }

  async addPlan(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    await this.trainingPlansService.add({
      name: this.name.trim(),
      description: this.description.trim(),
      exerciseIds: []
    });
    this.name = '';
    this.description = '';
    await this.load();
  }

  startEditPlan(plan: TrainingPlan): void {
    if (plan.isDefault) {
      return;
    }
    this.editingPlanId = plan.id;
    this.editName = plan.name;
    this.editDescription = plan.description ?? '';
  }

  cancelEditPlan(): void {
    this.editingPlanId = null;
  }

  async confirmEditPlan(plan: TrainingPlan): Promise<void> {
    const name = this.editName.trim();
    if (!name || plan.isDefault) {
      return;
    }
    this.editingPlanId = null;
    await this.trainingPlansService.update({ ...plan, name, description: this.editDescription.trim() });
    await this.load();
  }

  async requestDeletePlan(plan: TrainingPlan): Promise<void> {
    if (plan.isDefault) {
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { messageKey: 'trainingPlans.confirmDeleteQuestion' }
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }
    await this.trainingPlansService.delete(plan.id);
    await this.load();
  }

  async copyPlan(plan: TrainingPlan): Promise<void> {
    const { id: _id, isDefault: _isDefault, ...rest } = plan;
    await this.trainingPlansService.add({
      ...rest,
      name: plan.name + this.translationService.translate('trainingPlans.copySuffix'),
      exerciseConfigs: plan.exerciseConfigs?.map((config) => ({
        ...config,
        percentageWeeks: config.percentageWeeks?.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) }))
      })),
      isDefault: false
    });
    await this.load();
  }

  async updatePlanExercises(plan: TrainingPlan, exerciseIds: string[]): Promise<void> {
    if (plan.isDefault) {
      return;
    }
    plan.exerciseIds = exerciseIds;
    const existingByExerciseId = new Map((plan.exerciseConfigs ?? []).map((config) => [config.exerciseId, config]));
    plan.exerciseConfigs = exerciseIds.map(
      (exerciseId) =>
        existingByExerciseId.get(exerciseId) ?? {
          exerciseId,
          exerciseType: DEFAULT_EXERCISE_TYPE,
          warmupSets: DEFAULT_WARMUP_SETS,
          workingSets: DEFAULT_WORKING_SETS,
          cooldownSets: DEFAULT_COOLDOWN_SETS
        }
    );
    await this.trainingPlansService.update(plan);
  }

  async removePlanExercise(plan: TrainingPlan, exerciseId: string): Promise<void> {
    await this.updatePlanExercises(
      plan,
      plan.exerciseIds.filter((id) => id !== exerciseId)
    );
  }

  planExerciseConfig(plan: TrainingPlan, exerciseId: string): PlanExerciseConfig {
    return (
      plan.exerciseConfigs?.find((config) => config.exerciseId === exerciseId) ?? {
        exerciseId,
        exerciseType: DEFAULT_EXERCISE_TYPE,
        warmupSets: DEFAULT_WARMUP_SETS,
        workingSets: DEFAULT_WORKING_SETS,
        cooldownSets: DEFAULT_COOLDOWN_SETS
      }
    );
  }

  planExerciseTotalSets(plan: TrainingPlan, exerciseId: string): number {
    const config = this.planExerciseConfig(plan, exerciseId);
    const workingSets =
      config.exerciseType === 'PERCENTAGE_BASED' && config.percentageWeeks?.length
        ? config.percentageWeeks[0].sets.length
        : config.workingSets;
    return config.warmupSets + workingSets + config.cooldownSets;
  }

  // A plan whose percentage scheme repeats identically every session (e.g.
  // nSuns) has just one week; showing a "Week 1" wrapper around it would be
  // redundant, so its sets render directly under Working Sets instead.
  hasSinglePercentageWeek(plan: TrainingPlan, exerciseId: string): boolean {
    return this.planExerciseConfig(plan, exerciseId).percentageWeeks?.length === 1;
  }

  private async updateConfig(plan: TrainingPlan, exerciseId: string, patch: Partial<PlanExerciseConfig>): Promise<void> {
    if (plan.isDefault) {
      return;
    }
    const config = this.planExerciseConfig(plan, exerciseId);
    plan.exerciseConfigs = (plan.exerciseConfigs ?? []).map((c) =>
      c.exerciseId === exerciseId ? { ...config, ...patch } : c
    );
    await this.trainingPlansService.update(plan);
  }

  async updatePlanExerciseType(plan: TrainingPlan, exerciseId: string, exerciseType: PlanExerciseType): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const patch: Partial<PlanExerciseConfig> = { exerciseType };
    if (exerciseType === 'PERCENTAGE_BASED' && !config.percentageWeeks) {
      patch.percentageWeeks = DEFAULT_PERCENTAGE_WEEKS.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) }));
    }
    await this.updateConfig(plan, exerciseId, patch);
  }

  onPlanExerciseSetsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 3);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  private clampSets(value: string): number {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), PLAN_EXERCISE_SETS_MAX) : 0;
  }

  async updatePlanExerciseWarmupSets(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateConfig(plan, exerciseId, { warmupSets: this.clampSets(value) });
  }

  async updatePlanExerciseWorkingSets(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateConfig(plan, exerciseId, { workingSets: this.clampSets(value) });
  }

  async updatePlanExerciseCooldownSets(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateConfig(plan, exerciseId, { cooldownSets: this.clampSets(value) });
  }

  private async updatePercentageSet(
    plan: TrainingPlan,
    exerciseId: string,
    weekIndex: number,
    setIndex: number,
    patch: Partial<{ percentage: number; reps: number; isAmrap: boolean }>
  ): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const weeks = (config.percentageWeeks ?? []).map((week, wi) =>
      wi === weekIndex ? { sets: week.sets.map((set, si) => (si === setIndex ? { ...set, ...patch } : set)) } : week
    );
    await this.updateConfig(plan, exerciseId, { percentageWeeks: weeks });
  }

  async updatePercentageSetPercentage(
    plan: TrainingPlan,
    exerciseId: string,
    weekIndex: number,
    setIndex: number,
    value: string
  ): Promise<void> {
    await this.updatePercentageSet(plan, exerciseId, weekIndex, setIndex, { percentage: this.clampSets(value) });
  }

  async updatePercentageSetReps(
    plan: TrainingPlan,
    exerciseId: string,
    weekIndex: number,
    setIndex: number,
    value: string
  ): Promise<void> {
    await this.updatePercentageSet(plan, exerciseId, weekIndex, setIndex, { reps: this.clampSets(value) });
  }

  async togglePercentageSetAmrap(
    plan: TrainingPlan,
    exerciseId: string,
    weekIndex: number,
    setIndex: number,
    isAmrap: boolean
  ): Promise<void> {
    await this.updatePercentageSet(plan, exerciseId, weekIndex, setIndex, { isAmrap });
  }

  percentageSetWeight(exerciseId: string, percentage: number): number | null {
    const oneRepMax = this.exercises.find((exercise) => exercise.id === exerciseId)?.oneRepMax;
    if (!oneRepMax) {
      return null;
    }
    const increment = this.settingsService.getSettings().weightUnit === 'lbs' ? 5 : 2.5;
    return Math.round((oneRepMax * percentage) / 100 / increment) * increment;
  }
}
