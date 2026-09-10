import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
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
  DoubleProgressionMode,
  WorkingSetTarget,
  PercentageSet,
  CustomPlanSession,
  CustomSessionExercise,
  PlanDayGroup
} from '../core/models/training-plan.model';
import { Exercise, WarmupRampStep } from '../core/models/exercise.model';
import { calculateWarmupSets } from '../core/utils/warmup-ramp.util';
import {
  AddDefaultWarmupDialogComponent,
  AddDefaultWarmupDialogData,
  AddDefaultWarmupRow,
  AddDefaultWarmupSelection
} from '../sessions/add-default-warmup-dialog/add-default-warmup-dialog.component';
import { GzclTier, TrainingMethodology } from '../core/models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from '../core/utils/tier-line-progression.util';
import { effectiveOneRepMax as computeEffectiveOneRepMax, oneRepMaxOverrideChecked } from '../core/utils/one-rep-max.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../core/directives/select-on-focus.directive';
import { DEFAULT_5X5_PLAN_ID } from '../core/data/default-5x5-plan';
import { DEFAULT_531_PLAN_ID } from '../core/data/default-531-plan';
import { DEFAULT_GZCLP_PLAN_ID } from '../core/data/default-gzclp-plan';
import { DEFAULT_GREYSKULL_PLAN_ID } from '../core/data/default-greyskull-plan';
import { DEFAULT_NSUNS_PLAN_ID } from '../core/data/default-nsuns-plan';
import { DEFAULT_HEAVYDUTY_PLAN_ID } from '../core/data/default-heavyduty-plan';
import { DEFAULT_HST_PLAN_ID } from '../core/data/default-hst-plan';
import { DEFAULT_GVT_PLAN_ID } from '../core/data/default-gvt-plan';
import { DEFAULT_BBB_PLAN_ID } from '../core/data/default-bbb-plan';
import { DEFAULT_TRIUMVIRATE_PLAN_ID } from '../core/data/default-triumvirate-plan';
import { DEFAULT_INDJS_PLAN_ID } from '../core/data/default-indjs-plan';
import { DEFAULT_TEXAS_METHOD_PLAN_ID } from '../core/data/default-texas-method-plan';

const DEFAULT_PLAN_DESCRIPTION_KEYS: Record<string, string> = {
  [DEFAULT_531_PLAN_ID]: 'trainingPlans.plan531Description',
  [DEFAULT_5X5_PLAN_ID]: 'trainingPlans.plan5x5Description',
  [DEFAULT_GZCLP_PLAN_ID]: 'trainingPlans.planGzclpDescription',
  [DEFAULT_NSUNS_PLAN_ID]: 'trainingPlans.planNsunsDescription',
  [DEFAULT_GREYSKULL_PLAN_ID]: 'trainingPlans.planGreyskullDescription',
  [DEFAULT_HEAVYDUTY_PLAN_ID]: 'trainingPlans.planHeavyDutyDescription',
  [DEFAULT_HST_PLAN_ID]: 'trainingPlans.planHstDescription',
  [DEFAULT_GVT_PLAN_ID]: 'trainingPlans.planGvtDescription',
  [DEFAULT_BBB_PLAN_ID]: 'trainingPlans.planBbbDescription',
  [DEFAULT_TRIUMVIRATE_PLAN_ID]: 'trainingPlans.planTriumvirateDescription',
  [DEFAULT_INDJS_PLAN_ID]: 'trainingPlans.planIndjsDescription',
  [DEFAULT_TEXAS_METHOD_PLAN_ID]: 'trainingPlans.planTexasMethodDescription'
};

const DEFAULT_WARMUP_SETS = 0;
const DEFAULT_WORKING_SETS = 3;
const DEFAULT_COOLDOWN_SETS = 0;
const PLAN_EXERCISE_SETS_MAX = 100;
const DEFAULT_EXERCISE_TYPE: PlanExerciseType = 'WEIGHT_BASED';
const DEFAULT_INCREMENT_SCHEME: IncrementScheme = 'LINEAR_PROGRESSION';
const DEFAULT_LINEAR_PROGRESSION_TARGET_REPS = '5';
const DEFAULT_LINEAR_PROGRESSION_LOWER_BOUND_SUFFICIENT = false;
// Flat fallback for weightIncrement when the field is left blank - no
// longer the body-region-based WEIGHT_INCREMENT_BY_EXERCISE_TYPE default.
const DEFAULT_WEIGHT_INCREMENT = 1;
// Above this, a deload is flagged as unusually high - the same flat cutoff
// for both a percent-mode reduction (%) and a weight-mode one (kg/lb).
const DELOAD_UNUSUALLY_HIGH_THRESHOLD = 20;

type SetTargetField = 'warmupSetTargets' | 'workingSetTargets' | 'cooldownSetTargets';


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
    MatTabsModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatRadioModule,
    MatDialogModule,
    NgTemplateOutlet,
    DragDropModule,
    TranslatePipe,
    SelectOnFocusDirective
  ],
  templateUrl: './training-plans.component.html',
  styleUrl: './training-plans.component.scss'
})
export class TrainingPlansComponent implements OnInit, OnDestroy {
  plans: TrainingPlan[] = [];
  exercises: Exercise[] = [];
  name = '';
  description = '';
  readonly descriptionMaxLength = 1000;
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
    // Releasing the mouse button that just opened the copy popup (after the
    // 500ms hold) fires its own click on the field afterwards - skip that
    // one click so it doesn't instantly close the popup it just opened.
    if (this.suppressNextDocumentClick) {
      this.suppressNextDocumentClick = false;
      return;
    }
    const target = event.target as HTMLElement | null;
    if (this.descriptionInfoOpenPlanId && !target?.closest('.description-info-trigger')) {
      this.closeDescriptionInfo();
    }
    if (this.setTargetCopyPopupKey && !target?.closest('.set-target-copy-popup')) {
      this.closeSetTargetCopyPopup();
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

  // Holding a "Ziel-WDH"/weight field's own mouse button down for >500ms
  // (without releasing) opens a popup offering to copy that field's current
  // value across the whole exercise - every one of its warm-up/working/
  // cooldown sets, not just the one list the field itself belongs to, same
  // as the analogous session-level target-reps field already does. A quick
  // click/type is unaffected, since the popup only appears once the timer
  // actually fires.
  private longPressTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private suppressNextDocumentClick = false;
  private setTargetCopyPopupKey: string | null = null;
  setTargetCopyPopupPosition: { top: number; left: number } | null = null;
  private setTargetCopyContext: {
    plan: TrainingPlan;
    exerciseId: string;
    field: SetTargetField;
    index: number;
    kind: 'targetReps' | 'weight';
  } | null = null;

  onSetTargetFieldMouseDown(
    event: MouseEvent,
    plan: TrainingPlan,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    kind: 'targetReps' | 'weight'
  ): void {
    this.clearLongPressTimer();
    const triggerEl = event.currentTarget as HTMLElement;
    this.longPressTimeoutId = setTimeout(() => {
      this.longPressTimeoutId = null;
      this.openSetTargetCopyPopup(plan, exerciseId, field, index, kind, triggerEl);
    }, 500);
  }

  onSetTargetFieldMouseUp(): void {
    this.clearLongPressTimer();
  }

  onSetTargetFieldMouseLeave(): void {
    this.clearLongPressTimer();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimeoutId !== null) {
      clearTimeout(this.longPressTimeoutId);
      this.longPressTimeoutId = null;
    }
  }

  private openSetTargetCopyPopup(
    plan: TrainingPlan,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    kind: 'targetReps' | 'weight',
    triggerEl: HTMLElement
  ): void {
    triggerEl.blur();
    this.suppressNextDocumentClick = true;
    const rect = triggerEl.getBoundingClientRect();
    this.setTargetCopyPopupPosition = { top: rect.bottom + 8, left: rect.left };
    this.setTargetCopyContext = { plan, exerciseId, field, index, kind };
    this.setTargetCopyPopupKey = `${plan.id}:${exerciseId}:${field}:${index}:${kind}`;
    this.fitPopupToViewport('set-target-copy-popup', this.setTargetCopyPopupPosition);
  }

  get setTargetCopyPopupOpen(): boolean {
    return this.setTargetCopyPopupKey !== null;
  }

  private closeSetTargetCopyPopup(): void {
    this.setTargetCopyPopupKey = null;
    this.setTargetCopyPopupPosition = null;
    this.setTargetCopyContext = null;
  }

  cancelSetTargetCopy(): void {
    this.closeSetTargetCopyPopup();
  }

  async copySetTargetToUnsetSets(): Promise<void> {
    await this.applySetTargetCopy(true);
  }

  async copySetTargetToAllSets(): Promise<void> {
    await this.applySetTargetCopy(false);
  }

  private async applySetTargetCopy(onlyUnset: boolean): Promise<void> {
    const ctx = this.setTargetCopyContext;
    if (!ctx) {
      return;
    }
    const { plan, exerciseId, field, index, kind } = ctx;
    this.closeSetTargetCopyPopup();
    const config = this.planExerciseConfig(plan, exerciseId);
    const source = config[field]?.[index];
    if (!source) {
      return;
    }

    const applyToList = (targets?: WorkingSetTarget[]): WorkingSetTarget[] | undefined => {
      if (!targets) {
        return targets;
      }
      return targets.map((target) => {
        if (kind === 'targetReps') {
          return onlyUnset && target.targetReps !== '' ? target : { ...target, targetReps: source.targetReps };
        }
        return onlyUnset && target.weight !== 0 ? target : { ...target, weight: source.weight };
      });
    };

    await this.updateConfig(plan, exerciseId, {
      warmupSetTargets: applyToList(config.warmupSetTargets),
      workingSetTargets: applyToList(config.workingSetTargets),
      cooldownSetTargets: applyToList(config.cooldownSetTargets)
    });
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

  async addCustomSession(plan: TrainingPlan): Promise<void> {
    if (plan.isDefault) {
      return;
    }
    const session: CustomPlanSession = { id: crypto.randomUUID(), exerciseIds: [], exercises: [], exerciseType: 'WEIGHT_BASED' };
    plan.customSessions = [...(plan.customSessions ?? []), session];
    await this.trainingPlansService.update(plan);
  }

  // Keeps each retained exercise's own working-set list intact - only
  // newly-added exercises start with an empty one, same convenience as
  // updatePlanExercises does for the old plan-level exerciseConfigs. A
  // newly-added exercise with its own warm-up ramp gets the same add-
  // default-warmup prompt as adding it to a live session (see
  // SessionsComponent.updateSessionExercises) - a plan has no "current
  // working weight" yet, so the ramp is scaled off 0 until the plan
  // author fills one in themselves (or uses addDefaultWarmupTo... below
  // again afterward to rescale it).
  async updateCustomSessionExercises(plan: TrainingPlan, sessionId: string, exerciseIds: string[]): Promise<void> {
    const session = (plan.customSessions ?? []).find((candidate) => candidate.id === sessionId);
    const existingByExerciseId = new Map((session?.exercises ?? []).map((exercise) => [exercise.exerciseId, exercise]));
    // Deselecting an exercise that already has configured sets would
    // silently discard them - confirm first, and restore the exercise (with
    // its sets untouched) into the selection if the user backs out.
    const deselectedIdsWithSets = (session?.exercises ?? [])
      .filter(
        (exercise) =>
          !exerciseIds.includes(exercise.exerciseId) &&
          (exercise.workingSetTargets.length > 0 || (exercise.warmupSetTargets?.length ?? 0) > 0 || (exercise.cooldownSetTargets?.length ?? 0) > 0)
      )
      .map((exercise) => exercise.exerciseId);
    if (deselectedIdsWithSets.length > 0) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: { messageKey: 'sessions.confirmRemoveExerciseWithSetsQuestion' }
      });
      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (!confirmed) {
        exerciseIds = [...exerciseIds, ...deselectedIdsWithSets];
      }
    }

    const newlyAddedIds = exerciseIds.filter((exerciseId) => !existingByExerciseId.has(exerciseId));
    const confirmedRampKeys = await this.confirmDefaultRampsForExercises(newlyAddedIds);

    plan.customSessions = (plan.customSessions ?? []).map((candidate) => {
      if (candidate.id !== sessionId) {
        return candidate;
      }
      const sessionExercises: CustomSessionExercise[] = exerciseIds.map((exerciseId) => {
        const existing = existingByExerciseId.get(exerciseId);
        if (existing) {
          return existing;
        }
        const exercise = this.exercises.find((candidate) => candidate.id === exerciseId);
        const warmupRamp = confirmedRampKeys.has(`${exerciseId}:warmup`) ? exercise?.warmupRamp : undefined;
        const cooldownRamp = confirmedRampKeys.has(`${exerciseId}:cooldown`) ? exercise?.cooldownRamp : undefined;
        const weightUnit = this.settingsService.getSettings().weightUnit;
        return {
          exerciseId,
          workingSetTargets: [],
          warmupSetTargets: warmupRamp?.length ? calculateWarmupSets(0, warmupRamp, weightUnit) : undefined,
          showWarmupSets: warmupRamp?.length ? true : undefined,
          cooldownSetTargets: cooldownRamp?.length ? calculateWarmupSets(0, cooldownRamp, weightUnit) : undefined,
          showCooldownSets: cooldownRamp?.length ? true : undefined,
          incrementScheme: DEFAULT_INCREMENT_SCHEME,
          weightIncrement: DEFAULT_WEIGHT_INCREMENT
        };
      });
      return { ...candidate, exerciseIds, exercises: sessionExercises };
    });
    await this.trainingPlansService.update(plan);
  }

  // Removes one exercise from a custom session - same immediate-delete
  // behavior (no confirm step) as a flat plan's own per-exercise delete
  // button below.
  async removeCustomSessionExercise(plan: TrainingPlan, sessionId: string, exerciseId: string): Promise<void> {
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exerciseIds: session.exerciseIds.filter((id) => id !== exerciseId),
        exercises: (session.exercises ?? []).filter((exercise) => exercise.exerciseId !== exerciseId)
      };
    });
    await this.trainingPlansService.update(plan);
  }

  // Shared by every "add exercise(s) to a plan" entry point that should
  // offer the exercise's own warm-up/cooldown ramps - builds one row per
  // ramp an exercise actually has (an exercise with both kinds gets two
  // rows), skips the dialog entirely when there's nothing to ask about,
  // and returns the `${exerciseId}:${kind}` keys the user opted into
  // (same dialog SessionsComponent.updateSessionExercises uses).
  private async confirmDefaultRampsForExercises(candidateIds: string[]): Promise<Set<string>> {
    const rows: AddDefaultWarmupRow[] = candidateIds.flatMap((exerciseId) => {
      const exercise = this.exercises.find((candidate) => candidate.id === exerciseId);
      const exerciseRows: AddDefaultWarmupRow[] = [];
      if (exercise?.warmupRamp?.length) {
        exerciseRows.push({ exerciseId, exerciseName: this.exerciseName(exerciseId), kind: 'warmup', selected: true });
      }
      if (exercise?.cooldownRamp?.length) {
        exerciseRows.push({ exerciseId, exerciseName: this.exerciseName(exerciseId), kind: 'cooldown', selected: true });
      }
      return exerciseRows;
    });
    if (rows.length === 0) {
      return new Set();
    }
    const data: AddDefaultWarmupDialogData = { rows };
    const result = await firstValueFrom(
      this.dialog
        .open<AddDefaultWarmupDialogComponent, AddDefaultWarmupDialogData, AddDefaultWarmupSelection[]>(AddDefaultWarmupDialogComponent, { data })
        .afterClosed()
    );
    return new Set((result ?? []).map((selection) => `${selection.exerciseId}:${selection.kind}`));
  }

  // Retroactively (re)applies the exercise's warm-up ramp to one custom-
  // session exercise, replacing whatever warm-up targets it has now - for
  // whenever the initial add-prompt was declined, or the ramp was only
  // added to the exercise afterward. Scaled off this exercise's own first
  // working-set weight, same as a session's first working set feeds the
  // ramp in SessionsComponent.buildSessionFromPlan.
  async addDefaultWarmupToCustomSessionExercise(plan: TrainingPlan, sessionId: string, exerciseId: string): Promise<void> {
    const ramp = this.exercises.find((exercise) => exercise.id === exerciseId)?.warmupRamp;
    if (!ramp?.length) {
      return;
    }
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exercises: (session.exercises ?? []).map((exercise) => {
          if (exercise.exerciseId !== exerciseId) {
            return exercise;
          }
          const baseWeight = exercise.workingSetTargets?.[0]?.weight ?? 0;
          return {
            ...exercise,
            warmupSetTargets: calculateWarmupSets(baseWeight, ramp, this.settingsService.getSettings().weightUnit),
            showWarmupSets: true
          };
        })
      };
    });
    await this.trainingPlansService.update(plan);
  }

  // Same idea as addDefaultWarmupToCustomSessionExercise above, for the
  // cooldown ramp instead.
  async addDefaultCooldownToCustomSessionExercise(plan: TrainingPlan, sessionId: string, exerciseId: string): Promise<void> {
    const ramp = this.exercises.find((exercise) => exercise.id === exerciseId)?.cooldownRamp;
    if (!ramp?.length) {
      return;
    }
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exercises: (session.exercises ?? []).map((exercise) => {
          if (exercise.exerciseId !== exerciseId) {
            return exercise;
          }
          const baseWeight = exercise.workingSetTargets?.[0]?.weight ?? 0;
          return {
            ...exercise,
            cooldownSetTargets: calculateWarmupSets(baseWeight, ramp, this.settingsService.getSettings().weightUnit),
            showCooldownSets: true
          };
        })
      };
    });
    await this.trainingPlansService.update(plan);
  }

  // Same idea as addDefaultWarmupToCustomSessionExercise, for a flat
  // plan's own exerciseConfigs entry - also clears a prior opt-out, since
  // clicking this button is an explicit request to use the ramp now.
  async addDefaultWarmupToPlanExercise(plan: TrainingPlan, exerciseId: string): Promise<void> {
    const ramp = this.exercises.find((exercise) => exercise.id === exerciseId)?.warmupRamp;
    if (!ramp?.length) {
      return;
    }
    const config = this.planExerciseConfig(plan, exerciseId);
    const baseWeight = config.workingSetTargets?.[0]?.weight ?? 0;
    await this.updateConfig(plan, exerciseId, {
      warmupSetTargets: calculateWarmupSets(baseWeight, ramp, this.settingsService.getSettings().weightUnit),
      showWarmupSets: true,
      warmupRampDisabled: false
    });
  }

  // Same idea as addDefaultWarmupToPlanExercise above, for the cooldown
  // ramp instead.
  async addDefaultCooldownToPlanExercise(plan: TrainingPlan, exerciseId: string): Promise<void> {
    const ramp = this.exercises.find((exercise) => exercise.id === exerciseId)?.cooldownRamp;
    if (!ramp?.length) {
      return;
    }
    const config = this.planExerciseConfig(plan, exerciseId);
    const baseWeight = config.workingSetTargets?.[0]?.weight ?? 0;
    await this.updateConfig(plan, exerciseId, {
      cooldownSetTargets: calculateWarmupSets(baseWeight, ramp, this.settingsService.getSettings().weightUnit),
      showCooldownSets: true,
      cooldownRampDisabled: false
    });
  }

  async updateCustomSessionExerciseType(plan: TrainingPlan, sessionId: string, exerciseType: PlanExerciseType): Promise<void> {
    plan.customSessions = (plan.customSessions ?? []).map((session) =>
      session.id === sessionId ? { ...session, exerciseType } : session
    );
    await this.trainingPlansService.update(plan);
  }

  // Same "Settings" accordion as a default plan's own exercises (see
  // updateConfig) - patches one field on one exercise within one session.
  private async updateCustomSessionExerciseConfig(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    patch: Partial<CustomSessionExercise>
  ): Promise<void> {
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exercises: (session.exercises ?? []).map((exercise) =>
          exercise.exerciseId === exerciseId ? { ...exercise, ...patch } : exercise
        )
      };
    });
    await this.trainingPlansService.update(plan);
  }

  async updateCustomSessionExerciseIncrementScheme(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    incrementScheme: IncrementScheme
  ): Promise<void> {
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { incrementScheme });
  }

  customSessionWeightIncrementDisplay(exercise: CustomSessionExercise): string {
    return exercise.weightIncrement !== undefined ? exercise.weightIncrement.toFixed(2) : '';
  }

  async updateCustomSessionExerciseWeightIncrement(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const weightIncrement = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 9999) * 100) / 100 : undefined;
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { weightIncrement });
  }

  async updateCustomSessionExerciseIncrementType(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    incrementType: 'WEIGHT' | 'PERCENT'
  ): Promise<void> {
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { incrementType });
  }

  async updateCustomSessionExerciseDeloadAfterFailures(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    value: string
  ): Promise<void> {
    const parsed = parseInt(value, 10);
    const deloadAfterFailures = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1000) : undefined;
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { deloadAfterFailures });
  }

  customSessionDeloadPercentDisplay(exercise: CustomSessionExercise): string {
    return (exercise.deloadPercent ?? 0).toFixed(2);
  }

  async updateCustomSessionExerciseDeloadType(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    deloadType: 'WEIGHT' | 'PERCENT'
  ): Promise<void> {
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { deloadType });
  }

  // Percent mode - same 0-100 clamp as deloadAfterFailures' own tooltip
  // describes.
  async updateCustomSessionExerciseDeloadPercent(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const deloadPercent = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 100) * 100) / 100 : undefined;
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { deloadPercent });
  }

  // Weight mode - same 4-int/2-decimal clamp as every other weight field.
  async updateCustomSessionExerciseDeloadWeight(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const deloadPercent = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 9999) * 100) / 100 : undefined;
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { deloadPercent });
  }

  // Same flat cutoff either way - only the unit differs (% vs kg/lb).
  customSessionDeloadUnusuallyHigh(sessionExercise: CustomSessionExercise): boolean {
    return !!sessionExercise.deloadAfterFailures && (sessionExercise.deloadPercent ?? 0) > DELOAD_UNUSUALLY_HIGH_THRESHOLD;
  }

  // "Keine Gewichtsreduktion" - checking it zeroes both deload fields (0
  // already means "disabled" per deloadAfterFailures' own semantics);
  // unchecking re-enables them starting from a minimal 1-failure default.
  async updateCustomSessionExerciseNoDeload(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    checked: boolean
  ): Promise<void> {
    const patch = checked ? { deloadAfterFailures: 0, deloadPercent: 0 } : { deloadAfterFailures: 1 };
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, patch);
  }

  async updateCustomSessionExerciseShowWarmupSets(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    checked: boolean
  ): Promise<void> {
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { showWarmupSets: checked });
  }

  async updateCustomSessionExerciseShowCooldownSets(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    checked: boolean
  ): Promise<void> {
    await this.updateCustomSessionExerciseConfig(plan, sessionId, exerciseId, { showCooldownSets: checked });
  }

  private async updateCustomSessionSetTargets(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    updater: (targets: WorkingSetTarget[]) => WorkingSetTarget[]
  ): Promise<void> {
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exercises: (session.exercises ?? []).map((exercise) =>
          exercise.exerciseId === exerciseId ? { ...exercise, [field]: updater(exercise[field] ?? []) } : exercise
        )
      };
    });
    await this.trainingPlansService.update(plan);
  }

  // Copies the previous set's own target/weight, same convenience as
  // addSetTarget for the old plan-level editor - only the very first set
  // falls back to a default prescription (10 reps, 0 weight).
  // referenceExerciseId adds a warmup/cooldown target for a DIFFERENT
  // exercise than the one this list belongs to (see WorkingSetTarget.
  // referenceExerciseId) - picked via the reference-exercise picker's own
  // "Add set" button. Left unset, this is just a normal target for the
  // owning exercise, exactly as before this parameter existed.
  async addCustomSessionSet(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    referenceExerciseId?: string
  ): Promise<void> {
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) => {
      const sameReference = targets.filter((target) => target.referenceExerciseId === referenceExerciseId);
      const previous = sameReference[sameReference.length - 1];
      const newTarget: WorkingSetTarget = {
        id: crypto.randomUUID(),
        targetReps: previous?.targetReps ?? '10',
        weight: previous?.weight ?? 0,
        seconds: previous?.seconds ?? 0
      };
      if (referenceExerciseId) {
        newTarget.referenceExerciseId = referenceExerciseId;
      }
      return [...targets, newTarget];
    });
  }

  async removeCustomSessionSet(plan: TrainingPlan, sessionId: string, exerciseId: string, field: SetTargetField, index: number): Promise<void> {
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) => targets.filter((_, i) => i !== index));
  }

  // Reorders one custom session exercise's own set-target list (warm-up,
  // working, or cooldown are always separate arrays here, unlike a
  // session's flat sets array) - so a plain moveItemInArray on the field's
  // own targets is enough, no re-threading needed.
  async dropCustomSessionSet(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    event: CdkDragDrop<WorkingSetTarget[]>
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) => {
      const reordered = [...targets];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      return reordered;
    });
  }

  // Same fill-if-empty behavior as updateSetTargetReps for the old plan-level
  // editor - leaving this field fills the same target into every other
  // not-yet-prescribed row of the same exercise's set list.
  async updateCustomSessionSetReps(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    const targetReps = value.trim();
    if (!this.isValidTargetRepsText(targetReps)) {
      return;
    }
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) =>
      targets.map((target, i) => {
        if (i === index) {
          return { ...target, targetReps };
        }
        return targetReps !== '' && target.targetReps === '' ? { ...target, targetReps } : target;
      })
    );
  }

  // A committed target-reps value must be either empty (not yet prescribed)
  // or fully match the same "<lower>-<upper>+" grammar the input sanitizer
  // only prevents typing INVALID characters for, not incomplete ones - e.g.
  // clearing the field down to just "+" or "-" still passes the sanitizer
  // but must not be stored as-is.
  private isValidTargetRepsText(value: string): boolean {
    return value === '' || /^\d{1,4}(-\d{1,4})?\+?$/.test(value);
  }

  // Same fill-if-empty behavior as updateSetTargetWeight above, for weight.
  async updateCustomSessionSetWeight(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const weight = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) =>
      targets.map((target, i) => {
        if (i === index) {
          return { ...target, weight };
        }
        return weight > 0 && target.weight === 0 ? { ...target, weight } : target;
      })
    );
  }

  // Same 3-int/2-decimal percent field as deloadPercent - stored in the same
  // WorkingSetTarget.weight slot as a plain weight would be, just displayed
  // and clamped as a percentage while the exercise is PERCENTAGE_BASED.
  async updateCustomSessionSetPercentage(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    const weight = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 100) * 100) / 100 : 0;
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) =>
      targets.map((target, i) => (i === index ? { ...target, weight } : target))
    );
  }

  // Displayed with trailing zeros (e.g. "80.00"), matching setTargetWeightDisplay.
  customSessionSetWeightDisplay(target: WorkingSetTarget): string {
    return target.weight.toFixed(2);
  }

  // Time-Based sets prescribe a held duration instead of reps/weight - a
  // plain 5-digit integer (0-99999), initialized to 0.
  async updateCustomSessionSetSeconds(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    const parsed = parseInt(value, 10);
    const seconds = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 99999) : 0;
    await this.updateCustomSessionSetTargets(plan, sessionId, exerciseId, field, (targets) =>
      targets.map((target, i) => (i === index ? { ...target, seconds } : target))
    );
  }

  // Live preview only, never stored - same %1RM-to-weight rounding
  // convention as SessionsComponent.percentageSetWeight (nearest plate
  // increment), so what's previewed here matches what a generated session
  // actually prescribes.
  customSessionSetWeightPreview(exerciseId: string, percentage: number): number | undefined {
    const oneRepMax = this.effectiveOneRepMax(exerciseId);
    if (!oneRepMax) {
      return undefined;
    }
    const increment = this.settingsService.getSettings().weightUnit === 'lbs' ? 5 : 2.5;
    return Math.round((oneRepMax * percentage) / 100 / increment) * increment;
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

  // Same as planExerciseTotalSets, but honors a day group's own per-exercise
  // override (see PlanDayGroup.exerciseOverrides) when this exercise has
  // one for this day - otherwise the shared exerciseConfigs entry's set
  // count would be shown on every day, even ones where the actual generated
  // session carries a different count (e.g. Texas Method's squat: 5 sets on
  // the volume day but only 2 or 1 on the other two).
  dayGroupExerciseTotalSets(plan: TrainingPlan, dayGroup: PlanDayGroup, exerciseId: string): number {
    const override = dayGroup.exerciseOverrides?.[exerciseId];
    return override ? override.workingSets : this.planExerciseTotalSets(plan, exerciseId);
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
      // Genuinely empty - no weeks and no sets. addPercentageWeek/
      // addPercentageSet build the whole structure up from nothing as the
      // user actually adds to it, rather than pre-seeding a template.
      patch.percentageWeeks = [];
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

  // This field is always a percentage here (unlike a custom session
  // exercise's own deloadType toggle).
  planExerciseDeloadUnusuallyHigh(plan: TrainingPlan, exerciseId: string): boolean {
    const config = this.planExerciseConfig(plan, exerciseId);
    return !!config.deloadAfterFailures && (config.deloadPercent ?? 0) > DELOAD_UNUSUALLY_HIGH_THRESHOLD;
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

  // Same format/sanitizer as a session's own target-reps field: digits, an
  // optional dash range, then an optional trailing '+' for AMRAP.
  onWorkingSetTargetRepsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // The leading digit group is mandatory so "-" or "+" can never be the
    // first character typed. After the dash, the three alternatives are:
    // a full upper bound with its own optional AMRAP "+" ("-12", "-12+"),
    // just the bare dash on its own as an in-progress "8-" while its upper
    // bound is still being typed, or no dash at all with a bare "+" - never
    // a dash immediately followed by "+" ("8-+"), which would claim a
    // range with no upper bound.
    const sanitized = input.value.match(/^\d{1,4}(?:-\d{1,4}\+?|-|\+)?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // 5-digit integer, no decimals - 0 to 99999 seconds.
  onSecondsFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,5}/)?.[0] ?? '';
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

  // Same idea as dropCustomSessionSet above, for the plan-level editor's
  // own set-target list.
  async dropSetTarget(plan: TrainingPlan, exerciseId: string, field: SetTargetField, event: CdkDragDrop<WorkingSetTarget[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    await this.updateSetTargets(plan, exerciseId, field, (targets) => {
      const reordered = [...targets];
      moveItemInArray(reordered, event.previousIndex, event.currentIndex);
      return reordered;
    });
  }

  // Leaving this field fills the same target into every other not-yet-
  // prescribed row of the same list (warm-up/working/cooldown are separate
  // lists, so this never crosses between them) - a shared target only needs
  // to be typed once, without clobbering rows that already have their own.
  async updateSetTargetReps(
    plan: TrainingPlan,
    exerciseId: string,
    field: SetTargetField,
    index: number,
    value: string
  ): Promise<void> {
    const targetReps = value.trim();
    if (!this.isValidTargetRepsText(targetReps)) {
      return;
    }
    await this.updateSetTargets(plan, exerciseId, field, (targets) =>
      targets.map((target, i) => {
        if (i === index) {
          return { ...target, targetReps };
        }
        return targetReps !== '' && target.targetReps === '' ? { ...target, targetReps } : target;
      })
    );
  }

  // Same fill-if-empty behavior as updateSetTargetReps above, for weight.
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
      targets.map((target, i) => {
        if (i === index) {
          return { ...target, weight };
        }
        return weight > 0 && target.weight === 0 ? { ...target, weight } : target;
      })
    );
  }

  // Displayed with trailing zeros (e.g. "80.00"), matching the deload
  // percent and weight-increment fields' convention.
  setTargetWeightDisplay(target: WorkingSetTarget): string {
    return target.weight.toFixed(2);
  }

  // Same digit/decimal limit as any other weight field (e.g. a session set's
  // own weight input) - 4 leading digits, 2 decimals - not the 3-digit
  // percent-field convention, since this is a weight, not a percentage.
  onWeightIncrementFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
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
    const weightIncrement = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 9999) * 100) / 100 : undefined;
    await this.updateConfig(plan, exerciseId, { weightIncrement });
  }

  async updatePlanExerciseIncrementType(plan: TrainingPlan, exerciseId: string, incrementType: 'WEIGHT' | 'PERCENT'): Promise<void> {
    await this.updateConfig(plan, exerciseId, { incrementType });
  }

  // Shown as the weight-increment field's own placeholder - the fallback
  // actually applied (see sessions.component.ts) when the field is blank.
  readonly defaultWeightIncrement = DEFAULT_WEIGHT_INCREMENT;

  // The Cycle Days dropdown's fixed option list - only 1 to 7 are valid.
  readonly cycleDaysOptions = [1, 2, 3, 4, 5, 6, 7];

  // Defaults to 1 when unset, so the dropdown never starts out unselected.
  cycleDaysDisplay(plan: TrainingPlan, exerciseId: string): number {
    return this.planExerciseConfig(plan, exerciseId).cycleDays ?? 1;
  }

  async updatePlanExerciseCycleDays(plan: TrainingPlan, exerciseId: string, cycleDays: number): Promise<void> {
    await this.updateConfig(plan, exerciseId, { cycleDays });
  }

  async updatePlanExerciseShowWarmupSets(plan: TrainingPlan, exerciseId: string, checked: boolean): Promise<void> {
    await this.updateConfig(plan, exerciseId, { showWarmupSets: checked });
  }

  async updatePlanExerciseShowCooldownSets(plan: TrainingPlan, exerciseId: string, checked: boolean): Promise<void> {
    await this.updateConfig(plan, exerciseId, { showCooldownSets: checked });
  }

  // The exercise's own warm-up ramp (Stammdaten) - undefined when it has
  // none, in which case the hint/opt-out below never renders.
  exerciseWarmupRamp(exerciseId: string): WarmupRampStep[] | undefined {
    return this.exercises.find((exercise) => exercise.id === exerciseId)?.warmupRamp;
  }

  async updateWarmupRampDisabled(plan: TrainingPlan, exerciseId: string, disabled: boolean): Promise<void> {
    await this.updateConfig(plan, exerciseId, { warmupRampDisabled: disabled });
  }

  // Same idea as exerciseWarmupRamp above, for the cooldown ramp instead.
  exerciseCooldownRamp(exerciseId: string): WarmupRampStep[] | undefined {
    return this.exercises.find((exercise) => exercise.id === exerciseId)?.cooldownRamp;
  }

  // Exercises eligible for "add this exercise to the plan/session" pickers -
  // excludes anything marked as existing only to be picked as a warm-up/
  // cooldown reference elsewhere (still selectable there, just not here).
  // Same filter as SessionsComponent's own selectableExercises.
  selectableExercises(): Exercise[] {
    return this.exercises.filter((exercise) => !exercise.onlyAsWarmupExercise && !exercise.onlyAsCooldownExercise);
  }

  // Exercises offered in a custom-session exercise's own warm-up reference
  // picker - only ones explicitly marked usable there, and never the
  // exercise itself (it can't warm up with itself).
  warmupReferenceExerciseOptions(currentExerciseId: string): Exercise[] {
    return this.exercises.filter(
      (exercise) => exercise.id !== currentExerciseId && (exercise.useAsWarmupExercise || exercise.onlyAsWarmupExercise)
    );
  }

  // Same idea as warmupReferenceExerciseOptions above, for the cooldown
  // reference picker instead.
  cooldownReferenceExerciseOptions(currentExerciseId: string): Exercise[] {
    return this.exercises.filter(
      (exercise) => exercise.id !== currentExerciseId && (exercise.useAsCooldownExercise || exercise.onlyAsCooldownExercise)
    );
  }

  // Purely a reference list of another exercise to warm up/cool down with -
  // never generates sets, unlike updateCustomSessionExercises above. See
  // CustomSessionExercise.warmupExerciseId/cooldownExerciseId.
  async updateCustomSessionExerciseWarmupReference(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    warmupExerciseId: string
  ): Promise<void> {
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exercises: (session.exercises ?? []).map((exercise) =>
          exercise.exerciseId === exerciseId ? { ...exercise, warmupExerciseId } : exercise
        )
      };
    });
    await this.trainingPlansService.update(plan);
  }

  async updateCustomSessionExerciseCooldownReference(
    plan: TrainingPlan,
    sessionId: string,
    exerciseId: string,
    cooldownExerciseId: string
  ): Promise<void> {
    plan.customSessions = (plan.customSessions ?? []).map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return {
        ...session,
        exercises: (session.exercises ?? []).map((exercise) =>
          exercise.exerciseId === exerciseId ? { ...exercise, cooldownExerciseId } : exercise
        )
      };
    });
    await this.trainingPlansService.update(plan);
  }

  async updateCooldownRampDisabled(plan: TrainingPlan, exerciseId: string, disabled: boolean): Promise<void> {
    await this.updateConfig(plan, exerciseId, { cooldownRampDisabled: disabled });
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

  async addPercentageSet(plan: TrainingPlan, exerciseId: string, weekIndex: number): Promise<void> {
    // Copies the previous set's own percentage/reps/AMRAP, same convenience
    // as addSetTarget for a WEIGHT_BASED exercise - only the very first set
    // in the week falls back to a default prescription (100% x 1, not
    // AMRAP) instead of a blank one, since 0%/0 reps isn't a meaningful
    // starting point for a percentage-based set.
    const config = this.planExerciseConfig(plan, exerciseId);
    const weeks = (config.percentageWeeks ?? []).map((week, wi) => {
      if (wi !== weekIndex) {
        return week;
      }
      const previous = week.sets[week.sets.length - 1];
      const newSet: PercentageSet = previous
        ? { percentage: previous.percentage, reps: previous.reps, isAmrap: previous.isAmrap }
        : { percentage: 100, reps: 1, isAmrap: false };
      return { sets: [...week.sets, newSet] };
    });
    await this.updateConfig(plan, exerciseId, { percentageWeeks: weeks });
  }

  async removePercentageSet(plan: TrainingPlan, exerciseId: string, weekIndex: number, setIndex: number): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const weeks = (config.percentageWeeks ?? []).map((week, wi) =>
      wi === weekIndex ? { sets: week.sets.filter((_, si) => si !== setIndex) } : week
    );
    await this.updateConfig(plan, exerciseId, { percentageWeeks: weeks });
  }

  async addPercentageWeek(plan: TrainingPlan, exerciseId: string): Promise<void> {
    const config = this.planExerciseConfig(plan, exerciseId);
    const weeks = [...(config.percentageWeeks ?? []), { sets: [] }];
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

  // Same effective-1RM rule as SessionsComponent.effectiveOneRepMax, so the
  // exercise header's 1RM figure always matches what an actual session
  // generated from the plan will compute from.
  private effectiveOneRepMax(exerciseId: string): number | undefined {
    const exercise = this.exercises.find((e) => e.id === exerciseId);
    return exercise ? computeEffectiveOneRepMax(exercise) : undefined;
  }

  // Shown once in the exercise's own accordion header, replacing the
  // per-AMRAP-checkbox weight preview that used to repeat it on every set.
  exerciseOneRepMax(exerciseId: string): number | undefined {
    return this.effectiveOneRepMax(exerciseId);
  }

  // Which symbol the header's 1RM figure should use - "≈" for an
  // auto-estimate, "=" for an exact custom override - same distinction
  // SessionsComponent.exerciseOneRepMaxLabelKey makes.
  exerciseOneRepMaxLabelKey(exerciseId: string): string {
    const exercise = this.exercises.find((e) => e.id === exerciseId);
    return exercise && oneRepMaxOverrideChecked(exercise) ? 'exercises.oneRepMaxCustom' : 'exercises.oneRepMaxEstimated';
  }
}
