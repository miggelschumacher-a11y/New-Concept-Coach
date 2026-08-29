import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { MatRadioModule } from '@angular/material/radio';
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
  IncrementScheme,
  PercentageWeek,
  DoubleProgressionMode
} from '../core/models/training-plan.model';
import { Exercise } from '../core/models/exercise.model';
import { GzclTier, TrainingMethodology } from '../core/models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from '../core/utils/tier-line-progression.util';
import { parseRepsRange } from '../core/utils/reps-range.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { DEFAULT_5X5_PLAN_ID } from '../core/data/default-5x5-plan';
import { DEFAULT_531_PLAN_ID } from '../core/data/default-531-plan';
import { DEFAULT_GZCLP_PLAN_ID } from '../core/data/default-gzclp-plan';
import { DEFAULT_GREYSKULL_PLAN_ID } from '../core/data/default-greyskull-plan';
import { DEFAULT_NSUNS_PLAN_ID } from '../core/data/default-nsuns-plan';
import { DEFAULT_HEAVYDUTY_PLAN_ID } from '../core/data/default-heavyduty-plan';
import { DEFAULT_HST_PLAN_ID } from '../core/data/default-hst-plan';

const DEFAULT_PLAN_DESCRIPTION_KEYS: Record<string, string> = {
  [DEFAULT_531_PLAN_ID]: 'trainingPlans.plan531Description',
  [DEFAULT_5X5_PLAN_ID]: 'trainingPlans.plan5x5Description',
  [DEFAULT_GZCLP_PLAN_ID]: 'trainingPlans.planGzclpDescription',
  [DEFAULT_NSUNS_PLAN_ID]: 'trainingPlans.planNsunsDescription',
  [DEFAULT_GREYSKULL_PLAN_ID]: 'trainingPlans.planGreyskullDescription',
  [DEFAULT_HEAVYDUTY_PLAN_ID]: 'trainingPlans.planHeavyDutyDescription',
  [DEFAULT_HST_PLAN_ID]: 'trainingPlans.planHstDescription'
};

const DEFAULT_WARMUP_SETS = 0;
const DEFAULT_WORKING_SETS = 3;
const DEFAULT_COOLDOWN_SETS = 0;
const PLAN_EXERCISE_SETS_MAX = 100;
const DEFAULT_EXERCISE_TYPE: PlanExerciseType = 'WEIGHT_BASED';
const DEFAULT_INCREMENT_SCHEME: IncrementScheme = 'LINEAR_PROGRESSION';
const DEFAULT_LINEAR_PROGRESSION_TARGET_REPS = '5';
const DEFAULT_LINEAR_PROGRESSION_LOWER_BOUND_SUFFICIENT = true;

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
    MatRadioModule,
    MatDialogModule,
    NgTemplateOutlet,
    TranslatePipe
  ],
  templateUrl: './training-plans.component.html',
  styleUrl: './training-plans.component.scss'
})
export class TrainingPlansComponent implements OnInit, OnDestroy {
  plans: TrainingPlan[] = [];
  exercises: Exercise[] = [];
  name = '';
  description = '';
  editingPlanId: string | null = null;
  editName = '';
  editDescription = '';
  private descriptionInfoOpenPlanId: string | null = null;
  descriptionInfoPosition: { top: number; left: number } | null = null;

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
    document.addEventListener('click', this.handleDocumentClick, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleDocumentClick, true);
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

  // 5/3/1 is the only default plan with a worked increment example so far -
  // its percentage-of-1RM progression is less self-explanatory than the
  // other schemes, since there's no visible "weight goes up" step anywhere
  // in the UI itself.
  isDefault531Plan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_531_PLAN_ID;
  }

  // Same rationale as 5/3/1: 5x5's linear progression convention (add
  // weight when you hit every rep, repeat when you don't) has no visible
  // step anywhere in the UI, since the plan itself has no Increment Scheme
  // set - it's purely a manual convention unless the user opts into Linear
  // Progression themselves.
  isDefault5x5Plan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_5X5_PLAN_ID;
  }

  // Unlike the plans above, GZCLP already tracks progression automatically
  // (TierLineProgression) and explains its own weight step per exercise via
  // the tier-line-info panel below. This section instead walks through what
  // that automation actually does across sessions, including the stage
  // change (5x3+ -> 6x2+ -> 10x1+) that the per-exercise panel doesn't show.
  isDefaultGzclpPlan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_GZCLP_PLAN_ID;
  }

  isDefaultGreyskullPlan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_GREYSKULL_PLAN_ID;
  }

  isDefaultNsunsPlan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_NSUNS_PLAN_ID;
  }

  isDefaultHeavyDutyPlan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_HEAVYDUTY_PLAN_ID;
  }

  isDefaultHstPlan(plan: TrainingPlan): boolean {
    return plan.id === DEFAULT_HST_PLAN_ID;
  }

  // Same pattern as the TierLine info popup on the Training Sessions page:
  // fixed positioning computed from the button's own rect, rather than
  // absolute positioning within the header, because mat-expansion-panel
  // clips overflowing content (needed for its collapse animation) and would
  // otherwise cut the popup off when the panel is collapsed.
  toggleDescriptionInfo(planId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.descriptionInfoOpenPlanId === planId) {
      this.closeDescriptionInfo();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popupWidth = 440;
    this.descriptionInfoPosition = {
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - popupWidth)
    };
    this.descriptionInfoOpenPlanId = planId;
  }

  isDescriptionInfoOpen(planId: string): boolean {
    return this.descriptionInfoOpenPlanId === planId;
  }

  private closeDescriptionInfo(): void {
    this.descriptionInfoOpenPlanId = null;
    this.descriptionInfoPosition = null;
  }

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    if (!this.descriptionInfoOpenPlanId) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.description-info-trigger')) {
      return;
    }
    this.closeDescriptionInfo();
  };

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

  // Linear Progression has no Config-level default to copy on first switch
  // (unlike the other three schemes), so if it's still DEFAULT_INCREMENT_SCHEME
  // its config needs seeding right here instead.
  private defaultExerciseConfig(exerciseId: string): PlanExerciseConfig {
    return {
      exerciseId,
      exerciseType: DEFAULT_EXERCISE_TYPE,
      incrementScheme: DEFAULT_INCREMENT_SCHEME,
      warmupSets: DEFAULT_WARMUP_SETS,
      workingSets: DEFAULT_WORKING_SETS,
      cooldownSets: DEFAULT_COOLDOWN_SETS,
      ...(DEFAULT_INCREMENT_SCHEME === 'LINEAR_PROGRESSION'
        ? {
            linearProgression: {
              targetReps: DEFAULT_LINEAR_PROGRESSION_TARGET_REPS,
              lowerBoundSufficient: DEFAULT_LINEAR_PROGRESSION_LOWER_BOUND_SUFFICIENT
            }
          }
        : {})
    };
  }

  async updatePlanExercises(plan: TrainingPlan, exerciseIds: string[]): Promise<void> {
    if (plan.isDefault) {
      return;
    }
    plan.exerciseIds = exerciseIds;
    const existingByExerciseId = new Map((plan.exerciseConfigs ?? []).map((config) => [config.exerciseId, config]));
    plan.exerciseConfigs = exerciseIds.map(
      (exerciseId) => existingByExerciseId.get(exerciseId) ?? this.defaultExerciseConfig(exerciseId)
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
    return plan.exerciseConfigs?.find((config) => config.exerciseId === exerciseId) ?? this.defaultExerciseConfig(exerciseId);
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

  async updatePlanExerciseIncrementScheme(
    plan: TrainingPlan,
    exerciseId: string,
    incrementScheme: IncrementScheme
  ): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const patch: Partial<PlanExerciseConfig> = { incrementScheme };
    // Global-with-override: the exercise's own rep range/mode starts as a copy
    // of the Config-level default, then can be edited independently per exercise.
    if (incrementScheme === 'DOUBLE_PROGRESSION' && !config.doubleProgression) {
      const settings = this.settingsService.getSettings();
      patch.doubleProgression = {
        lowerReps: settings.doubleProgressionLowerReps,
        upperReps: settings.doubleProgressionUpperReps,
        mode: settings.doubleProgressionMode
      };
    }
    if (incrementScheme === 'REP_GOAL' && !config.repGoal) {
      patch.repGoal = { totalRepGoal: this.settingsService.getSettings().repGoalTotalRepGoal };
    }
    if (incrementScheme === 'WAVE_PROGRESSION' && !config.waveProgression) {
      const settings = this.settingsService.getSettings();
      patch.waveProgression = {
        initialReps: settings.waveProgressionInitialReps,
        finalReps: settings.waveProgressionFinalReps,
        repsDecrement: settings.waveProgressionRepsDecrement
      };
    }
    // No Config-level default for this one - it's set directly per exercise.
    if (incrementScheme === 'LINEAR_PROGRESSION' && !config.linearProgression) {
      patch.linearProgression = {
        targetReps: DEFAULT_LINEAR_PROGRESSION_TARGET_REPS,
        lowerBoundSufficient: DEFAULT_LINEAR_PROGRESSION_LOWER_BOUND_SUFFICIENT
      };
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

  private async updateDoubleProgression(
    plan: TrainingPlan,
    exerciseId: string,
    patch: Partial<{ lowerReps: number; upperReps: number; mode: DoubleProgressionMode }>
  ): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    if (!config.doubleProgression) {
      return;
    }
    await this.updateConfig(plan, exerciseId, { doubleProgression: { ...config.doubleProgression, ...patch } });
  }

  async updateDoubleProgressionLowerReps(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateDoubleProgression(plan, exerciseId, { lowerReps: this.clampSets(value) });
  }

  async updateDoubleProgressionUpperReps(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateDoubleProgression(plan, exerciseId, { upperReps: this.clampSets(value) });
  }

  async updateDoubleProgressionMode(plan: TrainingPlan, exerciseId: string, mode: DoubleProgressionMode): Promise<void> {
    await this.updateDoubleProgression(plan, exerciseId, { mode });
  }

  async updateRepGoalTotalRepGoal(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    if (!config.repGoal) {
      return;
    }
    await this.updateConfig(plan, exerciseId, { repGoal: { totalRepGoal: this.clampSets(value) } });
  }

  private async updateWaveProgression(
    plan: TrainingPlan,
    exerciseId: string,
    patch: Partial<{ initialReps: number; finalReps: number; repsDecrement: number }>
  ): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    if (!config.waveProgression) {
      return;
    }
    await this.updateConfig(plan, exerciseId, { waveProgression: { ...config.waveProgression, ...patch } });
  }

  async updateWaveProgressionInitialReps(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateWaveProgression(plan, exerciseId, { initialReps: this.clampSets(value) });
  }

  async updateWaveProgressionFinalReps(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateWaveProgression(plan, exerciseId, { finalReps: this.clampSets(value) });
  }

  async updateWaveProgressionRepsDecrement(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    await this.updateWaveProgression(plan, exerciseId, { repsDecrement: this.clampSets(value) });
  }

  onLinearProgressionTargetRepsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^\d-]/g, '').slice(0, 7);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // A plain number ('5') behaves exactly as before; a range ('8-12') is only
  // meaningful together with the lowerBoundSufficient checkbox, so that
  // checkbox is only shown once a real range (min !== max) is entered.
  isLinearProgressionRange(plan: TrainingPlan, exerciseId: string): boolean {
    const config = this.planExerciseConfig(plan, exerciseId);
    if (!config.linearProgression) {
      return false;
    }
    const range = parseRepsRange(config.linearProgression.targetReps);
    return range.min !== range.max;
  }

  async updateLinearProgressionTargetReps(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    if (!config.linearProgression) {
      return;
    }
    const range = parseRepsRange(value);
    const normalized = range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
    await this.updateConfig(plan, exerciseId, {
      linearProgression: { ...config.linearProgression, targetReps: normalized }
    });
  }

  async updateLinearProgressionLowerBoundSufficient(plan: TrainingPlan, exerciseId: string, checked: boolean): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    if (!config.linearProgression) {
      return;
    }
    await this.updateConfig(plan, exerciseId, {
      linearProgression: { ...config.linearProgression, lowerBoundSufficient: checked }
    });
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
