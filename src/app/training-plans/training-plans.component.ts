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
  DoubleProgressionMode,
  WorkingSetTarget
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

type SetTargetField = 'warmupSetTargets' | 'workingSetTargets' | 'cooldownSetTargets';

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
    const target = event.target as HTMLElement | null;
    if (this.descriptionInfoOpenPlanId && !target?.closest('.description-info-trigger')) {
      this.closeDescriptionInfo();
    }
    if (this.exerciseSettingsOpenKey && !target?.closest('.exercise-settings-trigger')) {
      this.closeExerciseSettings();
    }
  };

  // Same viewport-fit correction as the Sessions page's popups: the initial
  // position is a best guess anchored to the trigger button, corrected a
  // tick later once the popup has actually rendered and its real size is
  // known, so it never clips off-screen.
  private fitPopupToViewport(dataKey: string, position: { top: number; left: number }): void {
    setTimeout(() => {
      const el = document.querySelector(`[data-popup-key="${dataKey}"]`) as HTMLElement | null;
      if (!el) {
        return;
      }
      const margin = 8;
      const rect = el.getBoundingClientRect();
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
      position.left = Math.min(Math.max(margin, position.left), maxLeft);
      position.top = Math.min(Math.max(margin, position.top), maxTop);
    });
  }

  // Deload settings popup for a single exercise within a non-default plan -
  // keyed by plan id + exercise id since the same exercise can appear across
  // multiple plans with independent settings.
  private exerciseSettingsOpenKey: string | null = null;
  exerciseSettingsPosition: { top: number; left: number } | null = null;

  toggleExerciseSettings(plan: TrainingPlan, exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    const key = `${plan.id}:${exerciseId}`;
    if (this.exerciseSettingsOpenKey === key) {
      this.closeExerciseSettings();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popupWidth = 260;
    this.exerciseSettingsPosition = {
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - popupWidth)
    };
    this.exerciseSettingsOpenKey = key;
    this.fitPopupToViewport(`exercise-settings-${key}`, this.exerciseSettingsPosition);
  }

  isExerciseSettingsOpen(plan: TrainingPlan, exerciseId: string): boolean {
    return this.exerciseSettingsOpenKey === `${plan.id}:${exerciseId}`;
  }

  private closeExerciseSettings(): void {
    this.exerciseSettingsOpenKey = null;
    this.exerciseSettingsPosition = null;
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
        percentageWeeks: config.percentageWeeks?.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) })),
        warmupSetTargets: config.warmupSetTargets?.map((target) => ({ ...target })),
        workingSetTargets: config.workingSetTargets?.map((target) => ({ ...target })),
        cooldownSetTargets: config.cooldownSetTargets?.map((target) => ({ ...target }))
      })),
      isDefault: false
    });
    await this.load();
  }

  private defaultWorkingSetTargets(count: number): WorkingSetTarget[] {
    return Array.from({ length: count }, () => ({
      id: crypto.randomUUID(),
      targetReps: DEFAULT_LINEAR_PROGRESSION_TARGET_REPS,
      weight: 0
    }));
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
      warmupSetTargets: this.defaultWorkingSetTargets(DEFAULT_WARMUP_SETS),
      workingSetTargets: this.defaultWorkingSetTargets(DEFAULT_WORKING_SETS),
      cooldownSetTargets: this.defaultWorkingSetTargets(DEFAULT_COOLDOWN_SETS),
      ...(DEFAULT_INCREMENT_SCHEME === 'LINEAR_PROGRESSION'
        ? { linearProgression: { lowerBoundSufficient: DEFAULT_LINEAR_PROGRESSION_LOWER_BOUND_SUFFICIENT } }
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

  // Self-healing: a config saved before workingSetTargets existed (or one
  // just switched to WEIGHT_BASED) gets a freshly-seeded list here rather
  // than needing a one-off migration - same pattern as defaultExerciseConfig
  // itself falling back for an exercise with no stored config at all. This
  // returns a fresh object for display; writes always go through
  // updateConfig, which persists its own patched copy separately.
  // Deterministic IDs here, not defaultWorkingSetTargets()'s random ones:
  // this runs on every template read (never persisted), so a stable id per
  // index keeps @for's track expression stable across change-detection
  // passes instead of re-creating the whole row list every check.
  private selfHealSetTargets(exerciseId: string, field: SetTargetField, count: number): WorkingSetTarget[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `${exerciseId}-${field}-${i}`,
      targetReps: DEFAULT_LINEAR_PROGRESSION_TARGET_REPS,
      weight: 0
    }));
  }

  // Self-healing: a config saved before warmup/working/cooldown set targets
  // existed (or one just switched to WEIGHT_BASED) gets freshly-seeded lists
  // here rather than needing a one-off migration - same pattern as
  // defaultExerciseConfig itself falling back for an exercise with no stored
  // config at all. This returns a fresh object for display; writes always go
  // through updateConfig, which persists its own patched copy separately.
  planExerciseConfig(plan: TrainingPlan, exerciseId: string): PlanExerciseConfig {
    const config = plan.exerciseConfigs?.find((c) => c.exerciseId === exerciseId) ?? this.defaultExerciseConfig(exerciseId);
    if (config.exerciseType !== 'WEIGHT_BASED') {
      return config;
    }
    const healed: Partial<PlanExerciseConfig> = {};
    if (!config.warmupSetTargets) {
      healed.warmupSetTargets = this.selfHealSetTargets(exerciseId, 'warmupSetTargets', config.warmupSets);
    }
    if (!config.workingSetTargets) {
      healed.workingSetTargets = this.selfHealSetTargets(exerciseId, 'workingSetTargets', config.workingSets || DEFAULT_WORKING_SETS);
    }
    if (!config.cooldownSetTargets) {
      healed.cooldownSetTargets = this.selfHealSetTargets(exerciseId, 'cooldownSetTargets', config.cooldownSets);
    }
    return Object.keys(healed).length ? { ...config, ...healed } : config;
  }

  planExerciseTotalSets(plan: TrainingPlan, exerciseId: string): number {
    const config = this.planExerciseConfig(plan, exerciseId);
    let warmupSets = config.warmupSets;
    let workingSets = config.workingSets;
    let cooldownSets = config.cooldownSets;
    if (config.exerciseType === 'PERCENTAGE_BASED' && config.percentageWeeks?.length) {
      workingSets = config.percentageWeeks[0].sets.length;
    } else if (config.exerciseType === 'WEIGHT_BASED') {
      warmupSets = config.warmupSetTargets?.length ?? 0;
      workingSets = config.workingSetTargets?.length ?? 0;
      cooldownSets = config.cooldownSetTargets?.length ?? 0;
    }
    return warmupSets + workingSets + cooldownSets;
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
    if (exerciseType === 'WEIGHT_BASED') {
      if (!config.warmupSetTargets) {
        patch.warmupSetTargets = this.defaultWorkingSetTargets(config.warmupSets);
      }
      if (!config.workingSetTargets) {
        patch.workingSetTargets = this.defaultWorkingSetTargets(config.workingSets || DEFAULT_WORKING_SETS);
      }
      if (!config.cooldownSetTargets) {
        patch.cooldownSetTargets = this.defaultWorkingSetTargets(config.cooldownSets);
      }
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

  onDeloadFieldFocus(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  onDeloadAfterFailuresFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 4);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Allows up to 2 decimal places while typing, same pattern as the session
  // weight field - digits, an optional separator, then at most 2 digits.
  onDeloadPercentFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updatePlanExerciseDeloadAfterFailures(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    const deloadAfterFailures = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1000) : undefined;
    await this.updateConfig(plan, exerciseId, { deloadAfterFailures });
  }

  // Displayed with trailing zeros (e.g. "5.00") to match the fixed 2-decimal
  // precision the field is edited at, same convention as the weight fields.
  deloadPercentDisplay(plan: TrainingPlan, exerciseId: string): string {
    const deloadPercent = this.planExerciseConfig(plan, exerciseId).deloadPercent;
    return deloadPercent !== undefined ? deloadPercent.toFixed(2) : '';
  }

  async updatePlanExerciseDeloadPercent(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const deloadPercent = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 100) * 100) / 100 : undefined;
    await this.updateConfig(plan, exerciseId, { deloadPercent });
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

  onWorkingSetTargetFieldFocus(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  // Same format/sanitizer as a session's own target-reps field: digits, an
  // optional dash range, then an optional trailing '+' for AMRAP.
  onWorkingSetTargetRepsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}(-\d{0,3})?\+?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  onWorkingSetTargetWeightInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  private async updateSetTargets(
    plan: TrainingPlan,
    exerciseId: string,
    field: SetTargetField,
    updater: (targets: WorkingSetTarget[]) => WorkingSetTarget[]
  ): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const targets = updater(config[field] ?? []);
    await this.updateConfig(plan, exerciseId, { [field]: targets });
  }

  async addSetTarget(plan: TrainingPlan, exerciseId: string, field: SetTargetField): Promise<void> {
    // Copies the previous set's own target/weight, same convenience as
    // adding a set in a session - only the very first set falls back to a
    // blank prescription.
    await this.updateSetTargets(plan, exerciseId, field, (targets) => {
      const previous = targets[targets.length - 1];
      return [
        ...targets,
        { id: crypto.randomUUID(), targetReps: previous?.targetReps ?? '', weight: previous?.weight ?? 0 }
      ];
    });
  }

  async removeSetTarget(plan: TrainingPlan, exerciseId: string, field: SetTargetField, index: number): Promise<void> {
    await this.updateSetTargets(plan, exerciseId, field, (targets) => targets.filter((_, i) => i !== index));
  }

  async updateSetTargetReps(
    plan: TrainingPlan,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    await this.updateSetTargets(plan, exerciseId, field, (targets) =>
      targets.map((target, i) => (i === index ? { ...target, targetReps: value.trim() } : target))
    );
  }

  async updateSetTargetWeight(
    plan: TrainingPlan,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const weight = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    await this.updateSetTargets(plan, exerciseId, field, (targets) =>
      targets.map((target, i) => (i === index ? { ...target, weight } : target))
    );
  }

  // Displayed with trailing zeros (e.g. "80.00"), matching the deload
  // percent and weight-increment fields' convention.
  setTargetWeightDisplay(target: WorkingSetTarget): string {
    return target.weight.toFixed(2);
  }

  onWeightIncrementFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Displayed with trailing zeros, matching the deload percent field.
  weightIncrementDisplay(plan: TrainingPlan, exerciseId: string): string {
    const weightIncrement = this.planExerciseConfig(plan, exerciseId).weightIncrement;
    return weightIncrement !== undefined ? weightIncrement.toFixed(2) : '';
  }

  async updatePlanExerciseWeightIncrement(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const weightIncrement = Number.isFinite(parsed) ? Math.round(Math.max(parsed, 0) * 100) / 100 : undefined;
    await this.updateConfig(plan, exerciseId, { weightIncrement });
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

  async removePercentageSet(plan: TrainingPlan, exerciseId: string, weekIndex: number, setIndex: number): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const weeks = (config.percentageWeeks ?? []).map((week, wi) =>
      wi === weekIndex ? { sets: week.sets.filter((_, si) => si !== setIndex) } : week
    );
    await this.updateConfig(plan, exerciseId, { percentageWeeks: weeks });
  }

  async removePercentageWeek(plan: TrainingPlan, exerciseId: string, weekIndex: number): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const weeks = (config.percentageWeeks ?? []).filter((_, wi) => wi !== weekIndex);
    await this.updateConfig(plan, exerciseId, { percentageWeeks: weeks });
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
