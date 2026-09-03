import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { TranslationService } from '../core/services/translation.service';
import { TrainingPlansService } from '../core/services/training-plans.service';
import { TierLineProgressionService } from '../core/services/tier-line-progression.service';
import { DoubleProgressionService } from '../core/services/double-progression.service';
import { RepGoalService } from '../core/services/rep-goal.service';
import { WaveProgressionService } from '../core/services/wave-progression.service';
import { LinearProgressionService } from '../core/services/linear-progression.service';
import { BodyWeightService } from '../core/services/body-weight.service';
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';
import {
  TrainingPlan,
  TierLinePlanSession,
  TierLinePlanExercise,
  DoubleProgressionConfig,
  RepGoalConfig,
  WaveProgressionConfig,
  PlanExerciseType,
  IncrementScheme,
  PercentageProgressionMode,
  PercentageWeek,
  WorkingSetTarget
} from '../core/models/training-plan.model';
import { TrainingMethodology, GzclTier, TierLineProgressionState } from '../core/models/tier-line-progression.model';
import { DoubleProgressionState } from '../core/models/double-progression.model';
import { RepGoalState } from '../core/models/rep-goal.model';
import { WaveProgressionState } from '../core/models/wave-progression.model';
import { LinearProgressionState } from '../core/models/linear-progression.model';
import { BodyWeightEntry } from '../core/models/body-weight-entry.model';
import { TIER_LINE_SCHEME } from '../core/data/tier-line-scheme';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from '../core/utils/tier-line-progression.util';
import { computePrescribedReps } from '../core/utils/double-progression.util';
import { estimateOneRepMax, effectiveOneRepMax as computeEffectiveOneRepMax, oneRepMaxOverrideChecked } from '../core/utils/one-rep-max.util';
import { parseRepsRange } from '../core/utils/reps-range.util';
import { findBodyWeightForDate, BodyWeightLookupResult } from '../core/utils/body-weight-lookup.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Flat fallback for a plan exercise's weightIncrement when left blank - not
// the body-region-based WEIGHT_INCREMENT_BY_EXERCISE_TYPE default.
const DEFAULT_WEIGHT_INCREMENT = 1;

export const SET_TYPES: { value: SetType; labelKey: string; icon: string }[] = [
  { value: 'warmup', labelKey: 'sessions.warmupSets', icon: 'whatshot' },
  { value: 'working', labelKey: 'sessions.workingSets', icon: 'fitness_center' },
  { value: 'cooldown', labelKey: 'sessions.cooldownSets', icon: 'ac_unit' }
];

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatExpansionModule,
    MatTabsModule,
    MatCheckboxModule,
    DragDropModule,
    MatTooltipModule,
    DatePipe,
    NgTemplateOutlet,
    TranslatePipe
  ],
  providers: [DatePipe],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss'
})
export class SessionsComponent implements OnInit, OnDestroy {
  readonly setTypes = SET_TYPES;
  sessions: TrainingSession[] = [];
  exercises: Exercise[] = [];
  trainingPlans: TrainingPlan[] = [];
  selectedPlanId: string | null = null;
  pendingPlanId: string | null = null;
  private readonly selectedExerciseIdsCache = new Map<string, string[]>();
  private readonly unsavedSessionIds = new Set<string>();
  private readonly autoExpandedSessionIds = new Set<string>();
  private timerTickerId?: ReturnType<typeof setInterval>;
  pendingFinishSessionId: string | null = null;
  pendingDeleteSetId: string | null = null;
  pendingDeleteExerciseKey: string | null = null;
  pendingDeleteSessionId: string | null = null;
  pendingDeleteAllSessions = false;
  pendingReplenishSession: TrainingSession | null = null;
  finishBlockedSessionId: string | null = null;
  private readonly progressionStates = new Map<string, TierLineProgressionState>();
  private readonly doubleProgressionStates = new Map<string, DoubleProgressionState>();
  private readonly repGoalStates = new Map<string, RepGoalState>();
  private readonly waveProgressionStates = new Map<string, WaveProgressionState>();
  private readonly linearProgressionStates = new Map<string, LinearProgressionState>();

  bodyWeightEntries: BodyWeightEntry[] = [];
  private readonly confirmedBodyWeightFallbackSessionIds = new Set<string>();
  private readonly declinedBodyWeightFallbackSessionIds = new Set<string>();
  // Only sessions in here may show the fallback-confirm prompt - populated
  // when the session is started/resumed, not merely expanded.
  private readonly promptedBodyWeightFallbackSessionIds = new Set<string>();

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly translationService: TranslationService,
    private readonly trainingPlansService: TrainingPlansService,
    private readonly tierLineProgressionService: TierLineProgressionService,
    private readonly doubleProgressionService: DoubleProgressionService,
    private readonly repGoalService: RepGoalService,
    private readonly waveProgressionService: WaveProgressionService,
    private readonly linearProgressionService: LinearProgressionService,
    private readonly bodyWeightService: BodyWeightService,
    private readonly datePipe: DatePipe
  ) {}

  get dateFormat(): string {
    return `${this.settingsService.getSettings().dateFormat}, HH:mm`;
  }

  get language(): string {
    return this.settingsService.getSettings().language;
  }

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  get pendingSessions(): TrainingSession[] {
    return this.sessions.filter((session) => !session.finished).sort((a, b) => this.sortKey(a) - this.sortKey(b));
  }

  get pendingPlan(): TrainingPlan | undefined {
    return this.trainingPlans.find((p) => p.id === this.pendingPlanId);
  }

  get pendingPlanHasExistingSessions(): boolean {
    return this.pendingSessions.some((session) => session.trainingPlanId === this.pendingPlanId);
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.load(),
      this.loadExercises(),
      this.loadTrainingPlans(),
      this.loadProgressionStates(),
      this.loadBodyWeightEntries()
    ]);
    this.timerTickerId = setInterval(() => {}, 1000);
    document.addEventListener('click', this.handleDocumentClick, true);
  }

  ngOnDestroy(): void {
    if (this.timerTickerId) {
      clearInterval(this.timerTickerId);
    }
    if (this.doneAttemptTimeoutId) {
      clearTimeout(this.doneAttemptTimeoutId);
    }
    document.removeEventListener('click', this.handleDocumentClick, true);
  }

  async load(): Promise<void> {
    const sessions = await this.sessionsService.getAll();
    // Defends against legacy session records from an older data model that
    // predates the `exercises` field — without this, one such record throws
    // on `.length` access and breaks rendering of the entire session list.
    // Also backfills showWarmupSets/showCooldownSets (added later than
    // exercises itself) so records saved before they existed keep showing
    // both panels, matching the pre-existing default behavior.
    this.sessions = sessions.map((session) => ({
      ...session,
      exercises: (session.exercises ?? []).map((sessionExercise) => ({
        showWarmupSets: true,
        showCooldownSets: true,
        ...sessionExercise
      }))
    }));
  }

  async loadBodyWeightEntries(): Promise<void> {
    this.bodyWeightEntries = await this.bodyWeightService.getAll();
  }

  private sortKey(session: TrainingSession): number {
    return session.sequence ?? new Date(session.date).getTime();
  }

  async loadExercises(): Promise<void> {
    this.exercises = await this.exercisesService.getAll();
  }

  async loadTrainingPlans(): Promise<void> {
    this.trainingPlans = await this.trainingPlansService.getAll();
  }

  async loadProgressionStates(): Promise<void> {
    const states = await this.tierLineProgressionService.getAllStates();
    this.progressionStates.clear();
    for (const state of states) {
      this.progressionStates.set(state.id, state);
    }
  }

  private progressionKey(exerciseId: string, tier: GzclTier): string {
    return `${exerciseId}:${tier}`;
  }

  private findPlanExercise(session: TrainingSession, exerciseId: string): TierLinePlanExercise | undefined {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    const planSession = plan?.planSessions?.find((ps) => ps.id === session.planSessionId);
    return planSession?.exercises.find((planExercise) => planExercise.exerciseId === exerciseId);
  }

  isTierLineProgressionExercise(session: TrainingSession, exerciseId: string): boolean {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (plan?.methodology !== TrainingMethodology.TIER_LINE_PROGRESSION) {
      return false;
    }
    return !!this.findPlanExercise(session, exerciseId);
  }

  // A manually-created session (no plan) always allows editing these - a
  // plan-generated session hides them for TierLine-methodology plans
  // (tier/stage based, no exerciseType concept) and default (read-only)
  // plans, since neither has a real WEIGHT_BASED/PERCENTAGE_BASED/TIME_BASED
  // exerciseType to have started from.
  canEditExerciseTypeInSession(session: TrainingSession): boolean {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (!plan) {
      return true;
    }
    return plan.methodology !== TrainingMethodology.TIER_LINE_PROGRESSION && !plan.isDefault;
  }

  // Works around a MatTabGroup layout quirk: when it first paints while its
  // ancestor mat-expansion-panel is still animating open, its tab body can
  // get stuck measuring zero height, rendering blank until something forces
  // a relayout. A default/TierLine plan's exercise only ever has the single
  // Sets tab (see canEditExerciseTypeInSession above) and skips
  // mat-tab-group entirely for that reason, sidestepping the quirk there -
  // this still matters for the multi-tab case, where a resize is a more
  // reliable prompt than waiting on the user's own first tab switch.
  onSettingsPanelExpand(): void {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }

  exerciseTierLabelKey(session: TrainingSession, exerciseId: string): string | null {
    if (!this.isTierLineProgressionExercise(session, exerciseId)) {
      return null;
    }
    const planExercise = this.findPlanExercise(session, exerciseId);
    return planExercise ? 'trainingPlans.tier' + planExercise.tier.split('_')[0] : null;
  }

  tierLineWeightIncrement(exerciseId: string): number {
    const category = this.exercises.find((exercise) => exercise.id === exerciseId)?.weightCategory ?? 'UPPER_BODY';
    return WEIGHT_INCREMENT_BY_EXERCISE_TYPE[category];
  }

  // The popup's own rect is only known once it has actually rendered (its
  // height varies with content, e.g. the exercise-options popup grows once
  // the Linear Progression minReps field appears) - so the initial position
  // is a best guess anchored to the trigger button, corrected a tick later
  // by measuring the real element (found via its data-popup-key, since
  // these are duplicated per session/exercise in a @for loop) and clamping
  // it fully inside the viewport.
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

  private weightInfoOpenKey: string | null = null;
  weightInfoPosition: { top: number; left: number } | null = null;

  toggleWeightInfo(sessionId: string, exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    const key = `${sessionId}:${exerciseId}`;
    if (this.weightInfoOpenKey === key) {
      this.closeWeightInfo();
      return;
    }
    // Fixed positioning computed from the button's own rect, rather than
    // absolute positioning within the header, because mat-expansion-panel
    // clips overflowing content (needed for its collapse animation) and
    // would otherwise cut the popup off when the panel is collapsed.
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popupWidth = 320;
    this.weightInfoPosition = {
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - popupWidth)
    };
    this.weightInfoOpenKey = key;
    this.fitPopupToViewport(`weight-info-${key}`, this.weightInfoPosition);
  }

  isWeightInfoOpen(sessionId: string, exerciseId: string): boolean {
    return this.weightInfoOpenKey === `${sessionId}:${exerciseId}`;
  }

  private closeWeightInfo(): void {
    this.weightInfoOpenKey = null;
    this.weightInfoPosition = null;
  }

  // Bulk-applies the same four count/show preferences to every exercise in
  // the session at once. There's no single canonical value across exercises
  // to reflect, so the popup works off its own buffer - seeded from the
  // first exercise's settings (or true, the same default showSetType()
  // falls back to) - which is what actually gets pushed to every exercise
  // on change.
  private sessionSettingsInfoOpenKey: string | null = null;
  sessionSettingsInfoPosition: { top: number; left: number } | null = null;
  private sessionSettingsBuffers = new Map<
    string,
    { countWarmupSets: boolean; countCooldownSets: boolean; showWarmupSets: boolean; showCooldownSets: boolean }
  >();

  toggleSessionSettingsInfo(session: TrainingSession, event: MouseEvent): void {
    event.stopPropagation();
    if (this.sessionSettingsInfoOpenKey === session.id) {
      this.closeSessionSettingsInfo();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popupWidth = 280;
    this.sessionSettingsInfoPosition = {
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - popupWidth)
    };
    this.sessionSettingsInfoOpenKey = session.id;
    this.fitPopupToViewport(`session-settings-${session.id}`, this.sessionSettingsInfoPosition);
  }

  isSessionSettingsInfoOpen(sessionId: string): boolean {
    return this.sessionSettingsInfoOpenKey === sessionId;
  }

  private closeSessionSettingsInfo(): void {
    this.sessionSettingsInfoOpenKey = null;
    this.sessionSettingsInfoPosition = null;
  }

  sessionSettingsBuffer(session: TrainingSession): {
    countWarmupSets: boolean;
    countCooldownSets: boolean;
    showWarmupSets: boolean;
    showCooldownSets: boolean;
  } {
    let buffer = this.sessionSettingsBuffers.get(session.id);
    if (!buffer) {
      const first = session.exercises[0];
      buffer = {
        countWarmupSets: first?.countWarmupSets ?? true,
        countCooldownSets: first?.countCooldownSets ?? true,
        showWarmupSets: first?.showWarmupSets ?? true,
        showCooldownSets: first?.showCooldownSets ?? true
      };
      this.sessionSettingsBuffers.set(session.id, buffer);
    }
    return buffer;
  }

  // Not a toggle reflecting some current session-wide value (exercises can
  // individually disagree, so there isn't one) - each button is a one-shot
  // action that stamps every exercise's own option to true/false. Still
  // updates the buffer too, since updateSessionExercises seeds a freshly
  // added exercise from it.
  async applySessionSettingToAllExercises(
    session: TrainingSession,
    field: 'countWarmupSets' | 'countCooldownSets' | 'showWarmupSets' | 'showCooldownSets',
    value: boolean
  ): Promise<void> {
    this.sessionSettingsBuffer(session)[field] = value;
    for (const sessionExercise of session.exercises) {
      sessionExercise[field] = value;
    }
    await this.persist(session);
  }

  // Holding a "Ziel-WDH"/reps/weight set field's own mouse button down for
  // >500ms (without releasing) opens a popup offering to copy that field's
  // current value across the whole exercise's not-yet-done sets - same
  // popup as the analogous training-plan per-set fields. A quick click/type
  // is unaffected, since the popup only appears once the timer actually
  // fires. Done sets are never touched by either button, matching how the
  // existing on-blur weight/target-reps propagation already protects them.
  private longPressTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private suppressNextDocumentClick = false;
  private setFieldCopyPopupKey: string | null = null;
  setFieldCopyPopupPosition: { top: number; left: number } | null = null;
  private setFieldCopyContext: {
    session: TrainingSession;
    sessionExercise: SessionExercise;
    kind: 'targetReps' | 'reps' | 'weight';
    sourceValue: string;
  } | null = null;

  onSetFieldMouseDown(
    event: MouseEvent,
    session: TrainingSession,
    sessionExercise: SessionExercise,
    kind: 'targetReps' | 'reps' | 'weight'
  ): void {
    this.clearLongPressTimer();
    const triggerEl = event.currentTarget as HTMLInputElement;
    this.longPressTimeoutId = setTimeout(() => {
      this.longPressTimeoutId = null;
      this.openSetFieldCopyPopup(session, sessionExercise, kind, triggerEl);
    }, 500);
  }

  onSetFieldMouseUp(): void {
    this.clearLongPressTimer();
  }

  onSetFieldMouseLeave(): void {
    this.clearLongPressTimer();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimeoutId !== null) {
      clearTimeout(this.longPressTimeoutId);
      this.longPressTimeoutId = null;
    }
  }

  private openSetFieldCopyPopup(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    kind: 'targetReps' | 'reps' | 'weight',
    triggerEl: HTMLInputElement
  ): void {
    triggerEl.blur();
    this.suppressNextDocumentClick = true;
    const rect = triggerEl.getBoundingClientRect();
    this.setFieldCopyPopupPosition = { top: rect.bottom + 8, left: rect.left };
    this.setFieldCopyContext = { session, sessionExercise, kind, sourceValue: triggerEl.value };
    this.setFieldCopyPopupKey = `${session.id}:${sessionExercise.exerciseId}:${kind}`;
    this.fitPopupToViewport('set-field-copy-popup', this.setFieldCopyPopupPosition);
  }

  get setFieldCopyPopupOpen(): boolean {
    return this.setFieldCopyPopupKey !== null;
  }

  private closeSetFieldCopyPopup(): void {
    this.setFieldCopyPopupKey = null;
    this.setFieldCopyPopupPosition = null;
    this.setFieldCopyContext = null;
  }

  cancelSetFieldCopy(): void {
    this.closeSetFieldCopyPopup();
  }

  async copySetFieldToUnsetSets(): Promise<void> {
    await this.applySetFieldCopy(true);
  }

  async copySetFieldToAllSets(): Promise<void> {
    await this.applySetFieldCopy(false);
  }

  private async applySetFieldCopy(onlyUnset: boolean): Promise<void> {
    const ctx = this.setFieldCopyContext;
    if (!ctx) {
      return;
    }
    const { session, sessionExercise, kind, sourceValue } = ctx;
    this.closeSetFieldCopyPopup();

    if (kind === 'targetReps') {
      const trimmed = sourceValue.trim();
      if (trimmed !== '' && this.parseTargetRepsText(trimmed).targetReps === undefined) {
        return;
      }
      const { targetReps, targetRepsMax, isAmrap } = this.parseTargetRepsText(trimmed);
      if (targetReps !== undefined) {
        sessionExercise.minReps = targetRepsMax ?? targetReps;
      }
      for (const candidate of sessionExercise.sets) {
        if (candidate.done || (onlyUnset && candidate.targetReps !== undefined)) {
          continue;
        }
        candidate.targetReps = targetReps;
        candidate.targetRepsMax = targetRepsMax;
        candidate.isAmrap = isAmrap;
        if (targetReps !== undefined) {
          this.fieldBuffer(candidate).reps = String(targetRepsMax ?? targetReps);
        }
      }
    } else if (kind === 'weight') {
      const weight = parseFloat(sourceValue.replace(',', '.'));
      if (!Number.isFinite(weight)) {
        return;
      }
      for (const candidate of sessionExercise.sets) {
        if (candidate.done) {
          continue;
        }
        const currentWeight = parseFloat(this.fieldBuffer(candidate).weight.replace(',', '.'));
        if (onlyUnset && Number.isFinite(currentWeight) && currentWeight !== 0) {
          continue;
        }
        this.fieldBuffer(candidate).weight = weight.toFixed(2);
      }
    } else {
      const reps = parseInt(sourceValue, 10);
      if (!Number.isFinite(reps)) {
        return;
      }
      for (const candidate of sessionExercise.sets) {
        if (candidate.done) {
          continue;
        }
        const currentReps = parseInt(this.fieldBuffer(candidate).reps, 10);
        if (onlyUnset && Number.isFinite(currentReps) && currentReps !== 0) {
          continue;
        }
        this.fieldBuffer(candidate).reps = String(reps);
      }
    }

    await this.persist(session);
  }

  // Closes an open popup on any other click in the app (a different button,
  // an input, a panel toggle, etc.). Registered on the capture phase so it
  // runs before target handlers that call stopPropagation() elsewhere in
  // this component (e.g. the delete-confirm buttons) — a bubble-phase
  // listener would never see those clicks.
  private readonly handleDocumentClick = (event: MouseEvent): void => {
    // Releasing the mouse button that just opened the copy popup (after the
    // 500ms hold) fires its own click on the field afterwards - skip that
    // one click so it doesn't instantly close the popup it just opened.
    if (this.suppressNextDocumentClick) {
      this.suppressNextDocumentClick = false;
      return;
    }
    const target = event.target as HTMLElement | null;
    if (this.weightInfoOpenKey && !target?.closest('.weight-info-trigger')) {
      this.closeWeightInfo();
    }
    if (this.sessionSettingsInfoOpenKey && !target?.closest('.session-settings-info-trigger')) {
      this.closeSessionSettingsInfo();
    }
    if (this.setFieldCopyPopupKey && !target?.closest('.set-field-copy-popup')) {
      this.closeSetFieldCopyPopup();
    }
  };

  private async getOrInitProgressionState(planExercise: TierLinePlanExercise): Promise<TierLineProgressionState> {
    const key = this.progressionKey(planExercise.exerciseId, planExercise.tier);
    const cached = this.progressionStates.get(key);
    if (cached) {
      return cached;
    }
    const existing = await this.tierLineProgressionService.getState(planExercise.exerciseId, planExercise.tier);
    const state =
      existing ??
      (await this.tierLineProgressionService.initState(
        planExercise.exerciseId,
        planExercise.tier,
        0,
        planExercise.stage
      ));
    this.progressionStates.set(key, state);
    return state;
  }

  private async recordTierLineProgress(session: TrainingSession): Promise<void> {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (plan?.methodology !== TrainingMethodology.TIER_LINE_PROGRESSION || !session.planSessionId) {
      return;
    }
    const planSession = plan.planSessions?.find((ps) => ps.id === session.planSessionId);
    if (!planSession) {
      return;
    }
    for (const planExercise of planSession.exercises) {
      const sessionExercise = session.exercises.find((se) => se.exerciseId === planExercise.exerciseId);
      const workingSets = sessionExercise?.sets.filter((set) => set.type === 'working') ?? [];
      // Reps are pre-filled with the scheme's target value when the session is created, so an
      // untouched exercise still "achieves" its target reps on paper. Weight, however, always
      // starts at 0 and only becomes non-zero once the user actually enters something — so weight,
      // not reps, is what tells apart "not attempted" from a genuine result.
      if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
        continue;
      }
      const achievedReps = workingSets.map((set) => set.reps);
      const lastSetWeight = workingSets[workingSets.length - 1].weight;
      const category = this.exercises.find((exercise) => exercise.id === planExercise.exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const next = await this.tierLineProgressionService.recordSessionResult(
        planExercise.exerciseId,
        planExercise.tier,
        { achievedReps, lastSetWeight },
        category
      );
      this.progressionStates.set(this.progressionKey(planExercise.exerciseId, planExercise.tier), next);
    }
  }

  private async getOrInitDoubleProgressionState(exerciseId: string, seedWeight = 0): Promise<DoubleProgressionState> {
    const cached = this.doubleProgressionStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.doubleProgressionService.getState(exerciseId);
    const state = existing ?? (await this.doubleProgressionService.initState(exerciseId, seedWeight));
    this.doubleProgressionStates.set(exerciseId, state);
    return state;
  }

  private async recordDoubleProgressionProgress(session: TrainingSession): Promise<void> {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (!plan || plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION) {
      return;
    }
    for (const sessionExercise of session.exercises) {
      const config = plan.exerciseConfigs?.find((c) => c.exerciseId === sessionExercise.exerciseId);
      if (config?.exerciseType !== 'WEIGHT_BASED' || config.incrementScheme !== 'DOUBLE_PROGRESSION' || !config.doubleProgression) {
        continue;
      }
      const workingSets = sessionExercise.sets.filter((set) => set.type === 'working');
      // Same "attempted vs. untouched" distinction as recordTierLineProgress:
      // reps are pre-filled with the prescription, so weight is what tells
      // apart a genuine result from a set nobody actually logged.
      if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
        continue;
      }
      const achievedReps = workingSets.map((set) => set.reps);
      const lastSetWeight = workingSets[workingSets.length - 1].weight;
      const category =
        this.exercises.find((exercise) => exercise.id === sessionExercise.exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const next = await this.doubleProgressionService.recordSessionResult(
        sessionExercise.exerciseId,
        config.doubleProgression,
        { achievedReps, lastSetWeight },
        category,
        config.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
      );
      this.doubleProgressionStates.set(sessionExercise.exerciseId, next);
    }
  }

  private async getOrInitRepGoalState(exerciseId: string, seedWeight = 0): Promise<RepGoalState> {
    const cached = this.repGoalStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.repGoalService.getState(exerciseId);
    const state = existing ?? (await this.repGoalService.initState(exerciseId, seedWeight));
    this.repGoalStates.set(exerciseId, state);
    return state;
  }

  private async recordRepGoalProgress(session: TrainingSession): Promise<void> {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (!plan || plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION) {
      return;
    }
    for (const sessionExercise of session.exercises) {
      const config = plan.exerciseConfigs?.find((c) => c.exerciseId === sessionExercise.exerciseId);
      if (config?.exerciseType !== 'WEIGHT_BASED' || config.incrementScheme !== 'REP_GOAL' || !config.repGoal) {
        continue;
      }
      const workingSets = sessionExercise.sets.filter((set) => set.type === 'working');
      // Same "attempted vs. untouched" distinction as recordTierLineProgress:
      // weight is prefilled from the tracked state, reps are what the user
      // actually logs, so an untouched exercise still has every rep at 0.
      if (workingSets.length === 0 || workingSets.every((set) => set.reps === 0)) {
        continue;
      }
      const totalReps = workingSets.reduce((sum, set) => sum + set.reps, 0);
      const lastSetWeight = workingSets[workingSets.length - 1].weight;
      const category =
        this.exercises.find((exercise) => exercise.id === sessionExercise.exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const next = await this.repGoalService.recordSessionResult(
        sessionExercise.exerciseId,
        config.repGoal,
        { totalReps, lastSetWeight },
        category,
        config.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
      );
      this.repGoalStates.set(sessionExercise.exerciseId, next);
    }
  }

  private async getOrInitWaveProgressionState(
    exerciseId: string,
    config: WaveProgressionConfig,
    seedWeight = 0
  ): Promise<WaveProgressionState> {
    const cached = this.waveProgressionStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.waveProgressionService.getState(exerciseId);
    const state = existing ?? (await this.waveProgressionService.initState(exerciseId, config.initialReps, seedWeight));
    this.waveProgressionStates.set(exerciseId, state);
    return state;
  }

  private async recordWaveProgressionProgress(session: TrainingSession): Promise<void> {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (!plan || plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION) {
      return;
    }
    for (const sessionExercise of session.exercises) {
      const config = plan.exerciseConfigs?.find((c) => c.exerciseId === sessionExercise.exerciseId);
      if (config?.exerciseType !== 'WEIGHT_BASED' || config.incrementScheme !== 'WAVE_PROGRESSION' || !config.waveProgression) {
        continue;
      }
      const workingSets = sessionExercise.sets.filter((set) => set.type === 'working');
      if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
        continue;
      }
      const achievedReps = workingSets.map((set) => set.reps);
      const lastSetWeight = workingSets[workingSets.length - 1].weight;
      const category =
        this.exercises.find((exercise) => exercise.id === sessionExercise.exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const next = await this.waveProgressionService.recordSessionResult(
        sessionExercise.exerciseId,
        config.waveProgression,
        { achievedReps, lastSetWeight },
        category,
        config.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
      );
      this.waveProgressionStates.set(sessionExercise.exerciseId, next);
    }
  }

  private async getOrInitLinearProgressionState(exerciseId: string, seedWeight = 0): Promise<LinearProgressionState> {
    const cached = this.linearProgressionStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.linearProgressionService.getState(exerciseId);
    const state = existing ?? (await this.linearProgressionService.initState(exerciseId, seedWeight));
    this.linearProgressionStates.set(exerciseId, state);
    return state;
  }

  private async recordLinearProgressionProgress(session: TrainingSession): Promise<void> {
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    if (!plan || plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION) {
      return;
    }
    for (const sessionExercise of session.exercises) {
      const config = plan.exerciseConfigs?.find((c) => c.exerciseId === sessionExercise.exerciseId);
      if (config?.exerciseType !== 'WEIGHT_BASED' || config.incrementScheme !== 'LINEAR_PROGRESSION' || !config.linearProgression) {
        continue;
      }
      const workingSets = sessionExercise.sets.filter((set) => set.type === 'working');
      if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
        continue;
      }
      // Each working set now carries its own target (from the plan's own
      // working-set-target list, same as a session's target-reps field) -
      // success requires every set to individually meet its own target,
      // rather than one shared range for the whole exercise.
      const lowerBoundSufficient = config.linearProgression.lowerBoundSufficient;
      const success = workingSets.every((set) => {
        if (set.targetReps === undefined) {
          return true;
        }
        const required = lowerBoundSufficient ? set.targetReps : (set.targetRepsMax ?? set.targetReps);
        return set.reps >= required;
      });
      const lastSetWeight = workingSets[workingSets.length - 1].weight;
      const category =
        this.exercises.find((exercise) => exercise.id === sessionExercise.exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const next = await this.linearProgressionService.recordSessionResult(
        sessionExercise.exerciseId,
        success,
        { lastSetWeight },
        category,
        config.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
      );
      this.linearProgressionStates.set(sessionExercise.exerciseId, next);
    }
  }

  // Manual (non-plan) sessions have no exerciseConfigs to read a scheme's
  // settings from - unlike a plan exercise, a SessionExercise only carries
  // exerciseType/incrementScheme (plus minReps for Linear). So this mirrors
  // the four record*Progress methods above, but for Double/Rep Goal/Wave it
  // sources the scheme's config from the same Settings-page defaults a new
  // plan exercise would be seeded with, and for Linear from the exercise's
  // own minReps (the session-level equivalent of a plan's target reps).
  private async recordManualProgressionProgress(session: TrainingSession): Promise<void> {
    if (session.trainingPlanId) {
      return;
    }
    const settings = this.settingsService.getSettings();
    for (const sessionExercise of session.exercises) {
      if (sessionExercise.exerciseType !== 'WEIGHT_BASED' || !sessionExercise.incrementScheme) {
        continue;
      }
      const exerciseId = sessionExercise.exerciseId;
      const workingSets = sessionExercise.sets.filter((set) => set.type === 'working');
      const category = this.exercises.find((exercise) => exercise.id === exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const lastSetWeight = workingSets.length > 0 ? workingSets[workingSets.length - 1].weight : 0;

      switch (sessionExercise.incrementScheme) {
        case 'DOUBLE_PROGRESSION': {
          if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
            continue;
          }
          await this.getOrInitDoubleProgressionState(exerciseId);
          const config: DoubleProgressionConfig = {
            lowerReps: settings.doubleProgressionLowerReps,
            upperReps: settings.doubleProgressionUpperReps,
            mode: settings.doubleProgressionMode
          };
          const achievedReps = workingSets.map((set) => set.reps);
          const next = await this.doubleProgressionService.recordSessionResult(
            exerciseId,
            config,
            { achievedReps, lastSetWeight },
            category,
            sessionExercise.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
          );
          this.doubleProgressionStates.set(exerciseId, next);
          break;
        }
        case 'REP_GOAL': {
          if (workingSets.length === 0 || workingSets.every((set) => set.reps === 0)) {
            continue;
          }
          await this.getOrInitRepGoalState(exerciseId);
          const config: RepGoalConfig = { totalRepGoal: settings.repGoalTotalRepGoal };
          const totalReps = workingSets.reduce((sum, set) => sum + set.reps, 0);
          const next = await this.repGoalService.recordSessionResult(
            exerciseId,
            config,
            { totalReps, lastSetWeight },
            category,
            sessionExercise.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
          );
          this.repGoalStates.set(exerciseId, next);
          break;
        }
        case 'WAVE_PROGRESSION': {
          if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
            continue;
          }
          const config: WaveProgressionConfig = {
            initialReps: settings.waveProgressionInitialReps,
            finalReps: settings.waveProgressionFinalReps,
            repsDecrement: settings.waveProgressionRepsDecrement
          };
          await this.getOrInitWaveProgressionState(exerciseId, config);
          const achievedReps = workingSets.map((set) => set.reps);
          const next = await this.waveProgressionService.recordSessionResult(
            exerciseId,
            config,
            { achievedReps, lastSetWeight },
            category,
            sessionExercise.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
          );
          this.waveProgressionStates.set(exerciseId, next);
          break;
        }
        case 'LINEAR_PROGRESSION': {
          if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
            continue;
          }
          await this.getOrInitLinearProgressionState(exerciseId);
          // Manual sessions have no plan config for lowerBoundSufficient -
          // each set's own targetReps (its lower bound) is required, same as
          // a plan exercise with lowerBoundSufficient effectively true.
          const success = workingSets.every((set) => set.targetReps === undefined || set.reps >= set.targetReps);
          const next = await this.linearProgressionService.recordSessionResult(
            exerciseId,
            success,
            { lastSetWeight },
            category,
            sessionExercise.weightIncrement ?? DEFAULT_WEIGHT_INCREMENT
          );
          this.linearProgressionStates.set(exerciseId, next);
          break;
        }
        default:
          break;
      }
    }
  }

  isPaused(session: TrainingSession): boolean {
    return !session.finished && !session.timerRunning;
  }

  doneAttemptFieldKey: string | null = null;
  private doneAttemptTimeoutId?: ReturnType<typeof setTimeout>;

  // Reps and weight are readonly (not disabled) once a set is done, so
  // focusing them still fires - which is exactly what lets us catch the
  // attempt here, blur it back out, and surface a hint instead of just
  // silently ignoring the keystrokes. While the set is still open, entering
  // either field instead selects its whole value so typing overwrites it
  // right away.
  onSetFieldFocus(set: ExerciseSet, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!set.done) {
      input.select();
      return;
    }
    input.blur();
    this.doneAttemptFieldKey = set.id;
    if (this.doneAttemptTimeoutId) {
      clearTimeout(this.doneAttemptTimeoutId);
    }
    this.doneAttemptTimeoutId = setTimeout(() => {
      this.doneAttemptFieldKey = null;
    }, 2500);
  }

  isExpanded(session: TrainingSession): boolean {
    return this.autoExpandedSessionIds.has(session.id);
  }

  onExpandedChange(session: TrainingSession, expanded: boolean): void {
    if (expanded) {
      this.autoExpandedSessionIds.add(session.id);
      return;
    }
    this.autoExpandedSessionIds.delete(session.id);
    if (session.timerRunning) {
      void this.toggleTimer(session);
    }
  }

  exerciseName(id: string): string {
    return this.exercises.find((exercise) => exercise.id === id)?.name ?? id;
  }

  // True when the session's name starts with the "W{week}T{day}" shorthand
  // buildSessionFromPlan prefixes a one-exercise-per-session plan's bulk-
  // generated names with (see there) - gates the tooltip explaining it, so
  // it doesn't show on a session whose name never had (or was edited to no
  // longer have) that prefix.
  private static readonly WEEK_DAY_PREFIX_PATTERN = /^W\d+T\d+ /;

  sessionNameHasWeekDayPrefix(session: TrainingSession): boolean {
    return SessionsComponent.WEEK_DAY_PREFIX_PATTERN.test(session.name);
  }

  selectedExerciseIds(session: TrainingSession): string[] {
    const currentIds = session.exercises.map((sessionExercise) => sessionExercise.exerciseId);
    const cached = this.selectedExerciseIdsCache.get(session.id);
    if (cached && cached.length === currentIds.length && cached.every((id, i) => id === currentIds[i])) {
      return cached;
    }
    this.selectedExerciseIdsCache.set(session.id, currentIds);
    return currentIds;
  }

  addSession(): void {
    const now = new Date();
    const sessionWord = this.translationService.translate('sessions.defaultName');
    const name = `${sessionWord} ${this.datePipe.transform(now, this.dateFormat)}`;
    const session: TrainingSession = {
      id: crypto.randomUUID(),
      name,
      date: toDateTimeLocalValue(now),
      // Negative sequence: manually added sessions always float to the very
      // top of the pending list, newest on top, ahead of anything queued
      // from a training plan.
      sequence: -now.getTime(),
      exercises: [],
      timerElapsedMs: 0,
      timerRunning: false,
      timerStartedAt: undefined,
      startedAt: undefined,
      finished: false
    };
    this.unsavedSessionIds.add(session.id);
    this.sessions = [...this.sessions, session];
    void this.persist(session);
  }

  // The weight a replenished set starts at: for a working set on an exercise
  // that has a weight-based increment scheme with an already-tracked
  // progression state, that state's current weight (the same source
  // buildSessionFromPlan uses) - otherwise the finished set being
  // replenished keeps its own weight as-is. Never triggers initState here:
  // without the plan's full scheme config a manual session can't derive a
  // sensible starting weight, so an untracked exercise falls back too.
  private async peekProgressionWeight(sessionExercise: SessionExercise, set: ExerciseSet): Promise<number> {
    if (set.type !== 'working' || sessionExercise.exerciseType !== 'WEIGHT_BASED' || !sessionExercise.incrementScheme) {
      return set.weight;
    }
    const exerciseId = sessionExercise.exerciseId;
    let weight: number | undefined;
    switch (sessionExercise.incrementScheme) {
      case 'DOUBLE_PROGRESSION': {
        const state = this.doubleProgressionStates.get(exerciseId) ?? (await this.doubleProgressionService.getState(exerciseId));
        weight = state?.currentWeight;
        break;
      }
      case 'REP_GOAL': {
        const state = this.repGoalStates.get(exerciseId) ?? (await this.repGoalService.getState(exerciseId));
        weight = state?.currentWeight;
        break;
      }
      case 'WAVE_PROGRESSION': {
        const state = this.waveProgressionStates.get(exerciseId) ?? (await this.waveProgressionService.getState(exerciseId));
        weight = state?.currentWeight;
        break;
      }
      case 'LINEAR_PROGRESSION': {
        const state = this.linearProgressionStates.get(exerciseId) ?? (await this.linearProgressionService.getState(exerciseId));
        weight = state?.currentWeight;
        break;
      }
      default:
        return set.weight;
    }
    return weight === undefined ? set.weight : this.applyManualDeload(sessionExercise, weight);
  }

  private async buildManualReplenishment(sourceSession: TrainingSession): Promise<TrainingSession> {
    const now = new Date();
    const name = sourceSession.name;
    const exercises: SessionExercise[] = await Promise.all(
      sourceSession.exercises.map(async (sessionExercise) => ({
        exerciseId: sessionExercise.exerciseId,
        sets: await Promise.all(
          sessionExercise.sets.map(async (set) => ({
            id: crypto.randomUUID(),
            // Carries the just-finished set's own target reps forward (same
            // prescription, next session), same as addSet() already does for
            // a manually added set - and prefills the achieved-reps field
            // from that target's top (fieldBuffer()'s own convention), not
            // from cross-session history, now that there's a real target to
            // prefill from. Falls back to history when the set had no target.
            reps:
              set.targetReps !== undefined
                ? (set.targetRepsMax ?? set.targetReps)
                : this.defaultReps(sessionExercise.exerciseId, set.type, sessionExercise.minReps),
            weight: await this.peekProgressionWeight(sessionExercise, set),
            type: set.type,
            targetReps: set.targetReps,
            targetRepsMax: set.targetRepsMax,
            isAmrap: set.isAmrap
          }))
        ),
        countWarmupSets: sessionExercise.countWarmupSets,
        countCooldownSets: sessionExercise.countCooldownSets,
        showWarmupSets: sessionExercise.showWarmupSets,
        showCooldownSets: sessionExercise.showCooldownSets,
        exerciseType: sessionExercise.exerciseType,
        incrementScheme: sessionExercise.incrementScheme,
        minReps: sessionExercise.minReps,
        minWeight: sessionExercise.minWeight,
        deloadAfterFailures: sessionExercise.deloadAfterFailures,
        deloadPercent: sessionExercise.deloadPercent,
        weightIncrement: sessionExercise.weightIncrement,
        percentageProgressionMode: sessionExercise.percentageProgressionMode
      }))
    );
    return {
      id: crypto.randomUUID(),
      name,
      date: toDateTimeLocalValue(now),
      sequence: now.getTime(),
      exercises,
      timerElapsedMs: 0,
      timerRunning: false,
      timerStartedAt: undefined,
      startedAt: undefined,
      finished: false
    };
  }

  requestCreateFromPlan(): void {
    this.pendingPlanId = this.selectedPlanId;
    // Deferred: mat-select writes the newly selected value back onto the
    // ngModel right after emitting selectionChange, which would otherwise
    // clobber a synchronous reset here.
    setTimeout(() => (this.selectedPlanId = null));
  }

  cancelCreateFromPlan(): void {
    this.pendingPlanId = null;
  }

  async confirmCreateFromPlan(): Promise<void> {
    const plan = this.trainingPlans.find((p) => p.id === this.pendingPlanId);
    this.pendingPlanId = null;
    if (!plan) {
      return;
    }
    const baseSequence = Date.now();
    const newSessions =
      plan.planSessions && plan.planSessions.length > 0
        ? await Promise.all(
            plan.planSessions.map((planSession, index) =>
              this.buildSessionFromPlan(plan, planSession, baseSequence + index)
            )
          )
        : plan.oneExercisePerSession
          ? await this.buildOneExercisePerSessionCycle(plan, baseSequence)
          : [await this.buildSessionFromPlan(plan, null, baseSequence)];
    for (const session of newSessions) {
      this.unsavedSessionIds.add(session.id);
    }
    this.sessions = [...this.sessions, ...newSessions];
    for (const session of newSessions) {
      await this.persist(session);
    }
  }

  // For a oneExercisePerSession plan (e.g. 5/3/1), generates every week of
  // each exercise's percentage cycle up front - not just one session per
  // exercise that would only reach later weeks through replenishment - so
  // "Create from plan" produces the whole weekly-trained cycle in one go
  // (4 weeks x 4 lifts = 16 sessions for the default 5/3/1 plan). Ordered
  // week-by-week (every exercise's week 1, then every exercise's week 2, ...)
  // to match the order they'd actually be trained in, not exercise-by-
  // exercise. An exercise with fewer weeks than another (ONE_WEEK_RHYTHM
  // alongside FOUR_WEEK_RHYTHM, say) simply stops appearing once its own
  // weeks are exhausted.
  private async buildOneExercisePerSessionCycle(plan: TrainingPlan, baseSequence: number): Promise<TrainingSession[]> {
    const weeksCountFor = (exerciseId: string): number =>
      plan.exerciseConfigs?.find((c) => c.exerciseId === exerciseId)?.percentageWeeks?.length || 1;
    const maxWeeks = Math.max(...plan.exerciseIds.map(weeksCountFor));
    const jobs: { exerciseId: string; weekIndex: number }[] = [];
    for (let week = 0; week < maxWeeks; week++) {
      for (const exerciseId of plan.exerciseIds) {
        if (week < weeksCountFor(exerciseId)) {
          jobs.push({ exerciseId, weekIndex: week });
        }
      }
    }
    return Promise.all(
      jobs.map((job, index) => this.buildSessionFromPlan(plan, null, baseSequence + index, job.exerciseId, job.weekIndex))
    );
  }

  private async buildSessionFromPlan(
    plan: TrainingPlan,
    planSession: TierLinePlanSession | null,
    sequence: number,
    onlyExerciseId?: string,
    weekIndexOverride?: number
  ): Promise<TrainingSession> {
    const now = new Date();
    const name = planSession
      ? `${plan.name} – ${planSession.name}`
      : onlyExerciseId
        ? // "W{week}T{day}" (Wendler-style week/day shorthand) identifies
          // which of the cycle's sessions this is - kept as a prefix since
          // it's the detail readers scan for first, and short enough to
          // still leave room for the exercise name (which follows next,
          // ahead of the plan name, so it's what stays visible once the
          // collapsed session row's ellipsis truncation kicks in).
          (weekIndexOverride !== undefined
            ? `W${weekIndexOverride + 1}T${plan.exerciseIds.indexOf(onlyExerciseId) + 1} `
            : '') + `${this.exerciseName(onlyExerciseId)} – ${plan.name}`
        : plan.name;
    const isTierLine = plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION;
    const exercises: SessionExercise[] = planSession
      ? await Promise.all(
          planSession.exercises.map(async (planExercise) => {
            if (isTierLine) {
              const state = await this.getOrInitProgressionState(planExercise);
              const scheme = TIER_LINE_SCHEME[state.tier][state.stage];
              return {
                exerciseId: planExercise.exerciseId,
                sets: Array.from({ length: scheme.sets }, (_, index) => ({
                  id: crypto.randomUUID(),
                  reps: scheme.targetReps,
                  targetReps: scheme.targetReps,
                  isAmrap: scheme.isAmrapLastSet && index === scheme.sets - 1,
                  weight: state.currentWeight,
                  type: 'working' as SetType
                })),
                countWarmupSets: true,
                countCooldownSets: true,
                // A tier-line exercise has no warm-up/cooldown concept in its
                // plan config at all - always hidden, never just empty.
                showWarmupSets: false,
                showCooldownSets: false
              };
            }
            // planExercise.targetReps may be a range ('8-12'); a session set's
            // achieved reps always holds a single number, so the lower bound
            // is used there, while the upper bound (if any) is kept in
            // targetRepsMax so the full range can still be shown.
            const targetRepsRange = parseRepsRange(planExercise.targetReps);
            return {
              exerciseId: planExercise.exerciseId,
              sets: Array.from({ length: planExercise.sets }, () => ({
                id: crypto.randomUUID(),
                reps: targetRepsRange.min,
                targetReps: targetRepsRange.min,
                targetRepsMax: targetRepsRange.max !== targetRepsRange.min ? targetRepsRange.max : undefined,
                weight: this.defaultWeight(planExercise.exerciseId, 'working'),
                type: 'working' as SetType
              })),
              countWarmupSets: true,
              countCooldownSets: true,
              // Same as the tier-line case above - a plan-session exercise
              // has no warm-up/cooldown fields to configure in the first
              // place.
              showWarmupSets: false,
              showCooldownSets: false
            };
          })
        )
      : await Promise.all(
          (onlyExerciseId ? [onlyExerciseId] : plan.exerciseIds).map(async (exerciseId) => {
            const config = plan.exerciseConfigs?.find((c) => c.exerciseId === exerciseId);
            if (!config) {
              return {
                exerciseId,
                sets: [],
                countWarmupSets: true,
                countCooldownSets: true,
                showWarmupSets: false,
                showCooldownSets: false
              };
            }
            const buildSets = (count: number, type: SetType) =>
              Array.from({ length: count }, () => ({
                id: crypto.randomUUID(),
                reps: this.defaultReps(exerciseId, type),
                weight: this.defaultWeight(exerciseId, type),
                type
              }));

            // A per-set target list turns each of its rows into one literal
            // reps/weight set - no scheme, no deload, just what the plan
            // editor shows. Used as-is for warm-up/cooldown, and as the
            // None/Linear Progression fallback below. A config saved before
            // these target lists existed (including the hardcoded default
            // plans, e.g. 5x5) has no list at all - undefined, not an empty
            // array - so it falls back to the old plain-count generation
            // instead of silently producing zero sets; once a config is
            // migrated (even to an empty list, by deleting every row) its
            // list is respected as-is.
            const buildTargetSets = (
              targets: WorkingSetTarget[],
              type: SetType,
              weightFor: (target: WorkingSetTarget) => number = (target) => target.weight
            ) =>
              targets.map((target) => {
                const parsed = this.parseTargetRepsText(target.targetReps);
                return {
                  id: crypto.randomUUID(),
                  reps: parsed.targetRepsMax ?? parsed.targetReps ?? 0,
                  targetReps: parsed.targetReps,
                  targetRepsMax: parsed.targetRepsMax,
                  isAmrap: parsed.isAmrap,
                  weight: weightFor(target),
                  type
                };
              });

            const hasIncrementScheme = config.exerciseType === 'WEIGHT_BASED';
            // The exercise's own working-set list (WDH + weight per set) -
            // its length is the working-set count for any weight-based
            // scheme, and its first row's weight seeds a scheme's tracked
            // state the very first time it's initialized (see getOrInit*
            // above). Its own per-set targets are what actually generates
            // the sets for None/Linear Progression; Double/Rep Goal/Wave
            // keep deriving reps from their own scheme config as before.
            const workingSetTargets = hasIncrementScheme ? config.workingSetTargets : undefined;
            const workingSetCount = workingSetTargets?.length ?? config.workingSets;
            const seedWeight = workingSetTargets?.[0]?.weight ?? this.defaultWeight(exerciseId, 'working');
            let workingSets: SessionExercise['sets'];
            if (hasIncrementScheme && config.incrementScheme === 'DOUBLE_PROGRESSION' && config.doubleProgression) {
              const state = await this.getOrInitDoubleProgressionState(exerciseId, seedWeight);
              const prescribedReps = computePrescribedReps(config.doubleProgression, state.repsAddedThisCycle, workingSetCount);
              const weight = this.applyDeload(plan, exerciseId, state.currentWeight);
              workingSets = prescribedReps.map((reps) => ({
                id: crypto.randomUUID(),
                reps,
                targetReps: reps,
                weight,
                type: 'working' as SetType
              }));
            } else if (hasIncrementScheme && config.incrementScheme === 'REP_GOAL' && config.repGoal) {
              // No prescribed reps per set - each working set is pushed close
              // to failure and logged freely; only the tracked weight carries
              // over from session to session.
              const state = await this.getOrInitRepGoalState(exerciseId, seedWeight);
              const weight = this.applyDeload(plan, exerciseId, state.currentWeight);
              workingSets = Array.from({ length: workingSetCount }, () => ({
                id: crypto.randomUUID(),
                reps: 0,
                weight,
                type: 'working' as SetType
              }));
            } else if (hasIncrementScheme && config.incrementScheme === 'WAVE_PROGRESSION' && config.waveProgression) {
              const state = await this.getOrInitWaveProgressionState(exerciseId, config.waveProgression, seedWeight);
              const weight = this.applyDeload(plan, exerciseId, state.currentWeight);
              workingSets = Array.from({ length: workingSetCount }, () => ({
                id: crypto.randomUUID(),
                reps: state.currentReps,
                targetReps: state.currentReps,
                weight,
                type: 'working' as SetType
              }));
            } else if (hasIncrementScheme && config.incrementScheme === 'LINEAR_PROGRESSION' && config.linearProgression) {
              const state = await this.getOrInitLinearProgressionState(exerciseId, seedWeight);
              const weight = this.applyDeload(plan, exerciseId, state.currentWeight);
              workingSets = workingSetTargets
                ? buildTargetSets(workingSetTargets, 'working', () => weight)
                : buildSets(config.workingSets, 'working').map((set) => ({ ...set, weight }));
            } else if (hasIncrementScheme) {
              // NONE scheme - no tracked progression state, so each working
              // set always starts from its own configured target reps and
              // weight, same as the plan editor shows.
              workingSets = workingSetTargets
                ? buildTargetSets(workingSetTargets, 'working', (target) => this.applyDeload(plan, exerciseId, target.weight))
                : buildSets(config.workingSets, 'working');
            } else if (config.exerciseType === 'PERCENTAGE_BASED') {
              const percentageMode = config.percentageProgressionMode ?? 'FOUR_WEEK_RHYTHM';
              workingSets =
                this.percentageBasedWorkingSets(
                  exerciseId,
                  percentageMode,
                  config.percentageWeeks ?? [],
                  exerciseId === onlyExerciseId && weekIndexOverride !== undefined
                    ? weekIndexOverride
                    : this.planExerciseFinishedSessionCount(plan.id, exerciseId)
                ) ?? buildSets(config.workingSets, 'working');
            } else {
              // TIME_BASED - unaffected by the working-set-target list or
              // any weight concept, still just a plain count.
              workingSets = buildSets(config.workingSets, 'working');
            }

            // Warm-up/cooldown never get progression or deload - a target
            // list's weight is used exactly as configured.
            const warmupSetTargets = hasIncrementScheme ? config.warmupSetTargets : undefined;
            const cooldownSetTargets = hasIncrementScheme ? config.cooldownSetTargets : undefined;
            const warmupSets = warmupSetTargets
              ? buildTargetSets(warmupSetTargets, 'warmup')
              : buildSets(config.warmupSets, 'warmup');
            const cooldownSets = cooldownSetTargets
              ? buildTargetSets(cooldownSetTargets, 'cooldown')
              : buildSets(config.cooldownSets, 'cooldown');

            return {
              exerciseId,
              sets: [...warmupSets, ...workingSets, ...cooldownSets],
              countWarmupSets: true,
              countCooldownSets: true,
              // Defaults to hidden rather than an empty, pointless "(0)"
              // section when the plan itself has no warm-up/cooldown sets -
              // an explicit config.show*Sets still wins either way.
              showWarmupSets: config.showWarmupSets ?? warmupSets.length > 0,
              showCooldownSets: config.showCooldownSets ?? cooldownSets.length > 0,
              exerciseType: config.exerciseType,
              incrementScheme: config.incrementScheme,
              deloadAfterFailures: config.deloadAfterFailures,
              deloadPercent: config.deloadPercent,
              weightIncrement: config.weightIncrement,
              percentageProgressionMode: config.percentageProgressionMode
            };
          })
        );
    return {
      id: crypto.randomUUID(),
      name,
      date: toDateTimeLocalValue(now),
      trainingPlanId: plan.id,
      planSessionId: planSession?.id,
      sequence,
      exercises,
      timerElapsedMs: 0,
      timerRunning: false,
      timerStartedAt: undefined,
      startedAt: undefined,
      finished: false
    };
  }

  private async replenishSession(sourceSession: TrainingSession): Promise<void> {
    const newSession = sourceSession.trainingPlanId
      ? await this.buildPlanReplenishment(sourceSession)
      : await this.buildManualReplenishment(sourceSession);
    if (!newSession) {
      return;
    }
    this.unsavedSessionIds.add(newSession.id);
    this.sessions = [...this.sessions, newSession];
    await this.persist(newSession);
  }

  private async buildPlanReplenishment(sourceSession: TrainingSession): Promise<TrainingSession | null> {
    const plan = this.trainingPlans.find((p) => p.id === sourceSession.trainingPlanId);
    if (!plan) {
      return null;
    }
    const planSession = sourceSession.planSessionId
      ? (plan.planSessions?.find((ps) => ps.id === sourceSession.planSessionId) ?? null)
      : null;
    if (sourceSession.planSessionId && !planSession) {
      // Day template no longer exists on the plan; nothing to replenish.
      return null;
    }
    const onlyExerciseId =
      !planSession && plan.oneExercisePerSession ? sourceSession.exercises[0]?.exerciseId : undefined;
    return this.buildSessionFromPlan(plan, planSession, Date.now(), onlyExerciseId);
  }

  private async persist(session: TrainingSession): Promise<void> {
    if (!session.name.trim()) {
      return;
    }
    if (this.finishBlockedSessionId === session.id) {
      this.finishBlockedSessionId = null;
    }
    if (this.unsavedSessionIds.has(session.id)) {
      this.unsavedSessionIds.delete(session.id);
      await this.sessionsService.add(session);
    } else {
      await this.sessionsService.update(session);
    }
  }

  sessionDuration(session: TrainingSession): string {
    const baseElapsedMs = session.timerElapsedMs ?? 0;
    const elapsedMs =
      session.timerRunning && session.timerStartedAt
        ? baseElapsedMs + (Date.now() - new Date(session.timerStartedAt).getTime())
        : baseElapsedMs;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const pad = (value: number) => value.toString().padStart(2, '0');
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  async toggleTimer(session: TrainingSession): Promise<void> {
    if (session.finished) {
      return;
    }
    if (session.timerRunning && session.timerStartedAt) {
      session.timerElapsedMs = (session.timerElapsedMs ?? 0) + (Date.now() - new Date(session.timerStartedAt).getTime());
      session.timerRunning = false;
      session.timerStartedAt = undefined;
    } else {
      session.timerElapsedMs ??= 0;
      session.timerRunning = true;
      session.timerStartedAt = new Date().toISOString();
      session.startedAt ??= session.timerStartedAt;
      if (this.bodyWeightFallbackCandidate(session) !== null) {
        this.promptedBodyWeightFallbackSessionIds.add(session.id);
      }
    }
    await this.persist(session);
  }

  requestFinishSession(session: TrainingSession): void {
    this.pendingFinishSessionId = session.id;
  }

  cancelFinishSession(): void {
    this.pendingFinishSessionId = null;
  }

  async confirmFinishSession(session: TrainingSession): Promise<void> {
    this.pendingFinishSessionId = null;
    if (!session.name.trim()) {
      this.finishBlockedSessionId = session.id;
      return;
    }
    this.finishBlockedSessionId = null;
    if (session.timerRunning && session.timerStartedAt) {
      session.timerElapsedMs = (session.timerElapsedMs ?? 0) + (Date.now() - new Date(session.timerStartedAt).getTime());
    } else {
      session.timerElapsedMs ??= 0;
    }
    session.timerRunning = false;
    session.timerStartedAt = undefined;
    session.finished = true;
    await this.persist(session);
    await this.recordTierLineProgress(session);
    await this.recordDoubleProgressionProgress(session);
    await this.recordRepGoalProgress(session);
    await this.recordWaveProgressionProgress(session);
    await this.recordLinearProgressionProgress(session);
    await this.recordManualProgressionProgress(session);

    const mode = this.settingsService.getSettings().finishedSessionReplenishMode;
    if (mode === 'always') {
      await this.replenishSession(session);
    } else if (mode === 'ask') {
      this.pendingReplenishSession = session;
    }
    // Runs after replenishing (not before), so in "always" mode the sweep
    // also covers the session just created here - not only other, older
    // pending ones already sitting in the list.
    await this.refreshUpcomingSessionsWeights(session);
  }

  // The record*Progress calls above only advance the tracked progression
  // state - they never touch any OTHER session already sitting pending.
  // Without this, a plan day bulk-created earlier alongside the one just
  // finished (e.g. GZCLP's A2 created in the same batch as A1) keeps
  // showing the stale weight it was built with, even though the exercise
  // they share just advanced. Only not-yet-done working sets are touched -
  // untouched prescriptions get the fresh weight, logged results don't.
  private async refreshUpcomingSessionsWeights(finishedSession: TrainingSession): Promise<void> {
    const exerciseIds = new Set(finishedSession.exercises.map((sessionExercise) => sessionExercise.exerciseId));
    for (const session of this.sessions) {
      if (session.finished || session.id === finishedSession.id) {
        continue;
      }
      let changed = false;
      for (const sessionExercise of session.exercises) {
        if (!exerciseIds.has(sessionExercise.exerciseId)) {
          continue;
        }
        const newWeight = this.isTierLineProgressionExercise(session, sessionExercise.exerciseId)
          ? this.currentTierLineWeight(session, sessionExercise.exerciseId)
          : this.currentSchemeWeight(session, sessionExercise);
        if (newWeight === undefined) {
          continue;
        }
        for (const set of sessionExercise.sets) {
          if (set.type === 'working' && !set.done && set.weight !== newWeight) {
            set.weight = newWeight;
            changed = true;
          }
        }
      }
      if (changed) {
        await this.persist(session);
      }
    }
  }

  private currentTierLineWeight(session: TrainingSession, exerciseId: string): number | undefined {
    const planExercise = this.findPlanExercise(session, exerciseId);
    if (!planExercise) {
      return undefined;
    }
    return this.progressionStates.get(this.progressionKey(exerciseId, planExercise.tier))?.currentWeight;
  }

  private currentSchemeWeight(session: TrainingSession, sessionExercise: SessionExercise): number | undefined {
    if (sessionExercise.exerciseType !== 'WEIGHT_BASED' || !sessionExercise.incrementScheme) {
      return undefined;
    }
    const exerciseId = sessionExercise.exerciseId;
    let weight: number | undefined;
    switch (sessionExercise.incrementScheme) {
      case 'DOUBLE_PROGRESSION':
        weight = this.doubleProgressionStates.get(exerciseId)?.currentWeight;
        break;
      case 'REP_GOAL':
        weight = this.repGoalStates.get(exerciseId)?.currentWeight;
        break;
      case 'WAVE_PROGRESSION':
        weight = this.waveProgressionStates.get(exerciseId)?.currentWeight;
        break;
      case 'LINEAR_PROGRESSION':
        weight = this.linearProgressionStates.get(exerciseId)?.currentWeight;
        break;
      default:
        return undefined;
    }
    if (weight === undefined) {
      return weight;
    }
    if (!session.trainingPlanId) {
      return this.applyManualDeload(sessionExercise, weight);
    }
    const plan = this.trainingPlans.find((p) => p.id === session.trainingPlanId);
    return plan ? this.applyDeload(plan, exerciseId, weight) : weight;
  }

  // Counts back through this plan's own finished sessions for exerciseId
  // (or, when planId is undefined, every manual session's, since those
  // aren't scoped to any plan), most recent first, stopping at the first
  // session that wasn't a clean failure (succeeded, or its working sets
  // were never actually attempted - weight still at 0, same "untouched"
  // signal used elsewhere in this file). Scoped to working sets only, since
  // warmup/cooldown sets don't carry a pass/fail target relevant to a
  // deload decision.
  private consecutiveExerciseFailures(planId: string | undefined, exerciseId: string): number {
    const finishedSessions = this.sessions
      .filter((session) => session.trainingPlanId === planId && session.finished)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let count = 0;
    for (const session of finishedSessions) {
      const sessionExercise = session.exercises.find((se) => se.exerciseId === exerciseId);
      if (!sessionExercise) {
        continue;
      }
      const workingSets = sessionExercise.sets.filter((set) => set.type === 'working');
      if (workingSets.length === 0 || workingSets.every((set) => set.weight === 0)) {
        continue;
      }
      const succeeded = workingSets.every((set) => set.targetReps === undefined || set.reps >= set.targetReps);
      if (succeeded) {
        break;
      }
      count++;
    }
    return count;
  }

  // FOUR_WEEK_RHYTHM's week cycling: how many of this plan's finished
  // sessions have already included the exercise, used mod weeks.length to
  // pick the next week - so week 1 comes first, then 2, 3, 4, back to 1.
  private planExerciseFinishedSessionCount(planId: string | undefined, exerciseId: string): number {
    return this.sessions.filter(
      (session) => session.trainingPlanId === planId && session.finished && session.exercises.some((se) => se.exerciseId === exerciseId)
    ).length;
  }

  // Used by buildSessionFromPlan to generate a Percentage-Based exercise's
  // working sets fresh from its plan-config week templates each session.
  // Returns null when there's no template to generate from, so the caller
  // can fall back to a plain working-set count instead.
  private percentageBasedWorkingSets(
    exerciseId: string,
    percentageMode: PercentageProgressionMode,
    weeks: PercentageWeek[],
    finishedSessionCount: number
  ): ExerciseSet[] | null {
    if (percentageMode === 'ALL_SETS') {
      // No week/percentage cycling at all - the working weight simply
      // carries forward from history (like TIME_BASED). The first week's
      // sets are used purely as the reps-per-set template - their
      // percentage values are ignored in this mode.
      const template = weeks[0]?.sets;
      if (!template) {
        return null;
      }
      return template.map((set) => ({
        id: crypto.randomUUID(),
        reps: set.reps,
        targetReps: set.reps,
        isAmrap: set.isAmrap,
        weight: this.defaultWeight(exerciseId, 'working'),
        type: 'working' as SetType
      }));
    }
    // FOUR_WEEK_RHYTHM cycles through the weeks by position, one week per
    // session, wrapping back to the first week after the last (e.g. 5/3/1's
    // 3 build-up weeks + a deload week). ONE_WEEK_RHYTHM always uses the
    // first (only) week. Either way each set's weight is computed fresh
    // from the exercise's current 1RM times that set's own percentage -
    // never carried forward from history.
    const weekIndex = percentageMode === 'ONE_WEEK_RHYTHM' || !weeks.length ? 0 : finishedSessionCount % weeks.length;
    const template = weeks[weekIndex]?.sets;
    if (!template) {
      return null;
    }
    return template.map((set) => ({
      id: crypto.randomUUID(),
      reps: set.reps,
      targetReps: set.reps,
      isAmrap: set.isAmrap,
      weight: this.percentageSetWeight(exerciseId, set.percentage),
      percentage: set.percentage,
      type: 'working' as SetType
    }));
  }

  // Same %1RM-to-weight rounding convention as the plan editor's own
  // percentageSetWeight preview (nearest plate increment) - see
  // TrainingPlansComponent.percentageSetWeight.
  private percentageSetWeight(exerciseId: string, percentage: number): number {
    const oneRepMax = this.effectiveOneRepMax(exerciseId);
    if (!oneRepMax) {
      return 0;
    }
    const increment = this.settingsService.getSettings().weightUnit === 'lbs' ? 5 : 2.5;
    return Math.round((oneRepMax * percentage) / 100 / increment) * increment;
  }

  // Applies the configured deload once the exercise has failed this many
  // sessions in a row, recomputed fresh from session history every time
  // rather than tracked as separate persisted state - so it always reduces
  // from the scheme's own stable base weight (not compounding further each
  // session the streak continues), and a single logged success naturally
  // clears it since consecutiveExerciseFailures stops counting there.
  private applyDeload(plan: TrainingPlan, exerciseId: string, weight: number): number {
    const config = plan.exerciseConfigs?.find((c) => c.exerciseId === exerciseId);
    if (!config?.deloadAfterFailures || !config.deloadPercent) {
      return weight;
    }
    const failures = this.consecutiveExerciseFailures(plan.id, exerciseId);
    return failures >= config.deloadAfterFailures ? this.reduceByPercent(weight, config.deloadPercent) : weight;
  }

  // Manual sessions have no plan to hold this config - the same two fields
  // live directly on the session's own (editable, session-local) exercise
  // settings instead, and the failure streak is counted across all manual
  // sessions rather than scoped to one plan's.
  private applyManualDeload(sessionExercise: SessionExercise, weight: number): number {
    if (!sessionExercise.deloadAfterFailures || !sessionExercise.deloadPercent) {
      return weight;
    }
    const failures = this.consecutiveExerciseFailures(undefined, sessionExercise.exerciseId);
    return failures >= sessionExercise.deloadAfterFailures
      ? this.reduceByPercent(weight, sessionExercise.deloadPercent)
      : weight;
  }

  private reduceByPercent(weight: number, percent: number): number {
    return Math.round(weight * (1 - percent / 100) * 100) / 100;
  }

  async updateSessionExercises(session: TrainingSession, exerciseIds: string[]): Promise<void> {
    const existingByExerciseId = new Map(
      session.exercises.map((sessionExercise) => [sessionExercise.exerciseId, sessionExercise])
    );
    // A freshly added exercise starts with whatever the session's own
    // options currently hold (default true/true/true/true until the user
    // has touched the session-options popup, its actual values afterward),
    // rather than always hardcoding true regardless of that setting.
    const sessionSettings = this.sessionSettingsBuffer(session);
    session.exercises = exerciseIds.map(
      (exerciseId) =>
        existingByExerciseId.get(exerciseId) ?? {
          exerciseId,
          sets: [],
          countWarmupSets: sessionSettings.countWarmupSets,
          countCooldownSets: sessionSettings.countCooldownSets,
          showWarmupSets: sessionSettings.showWarmupSets,
          showCooldownSets: sessionSettings.showCooldownSets,
          // Matches Training Plans' own default for a freshly added exercise.
          exerciseType: 'WEIGHT_BASED',
          incrementScheme: 'LINEAR_PROGRESSION'
        }
    );
    await this.persist(session);
  }

  isPendingDeleteExercise(session: TrainingSession, exerciseId: string): boolean {
    return this.pendingDeleteExerciseKey === `${session.id}:${exerciseId}`;
  }

  requestRemoveExercise(session: TrainingSession, exerciseId: string): void {
    this.pendingDeleteExerciseKey = `${session.id}:${exerciseId}`;
  }

  cancelRemoveExercise(): void {
    this.pendingDeleteExerciseKey = null;
  }

  async confirmRemoveExercise(session: TrainingSession, exerciseId: string): Promise<void> {
    this.pendingDeleteExerciseKey = null;
    await this.removeExerciseFromSession(session, exerciseId);
  }

  async removeExerciseFromSession(session: TrainingSession, exerciseId: string): Promise<void> {
    session.exercises = session.exercises.filter((sessionExercise) => sessionExercise.exerciseId !== exerciseId);
    await this.persist(session);
  }

  async dropExercise(session: TrainingSession, event: CdkDragDrop<SessionExercise[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    moveItemInArray(session.exercises, event.previousIndex, event.currentIndex);
    await this.persist(session);
  }

  setsByType(sessionExercise: SessionExercise, type: SetType): ExerciseSet[] {
    return sessionExercise.sets.filter((set) => set.type === type);
  }

  showSetType(sessionExercise: SessionExercise, type: SetType): boolean {
    if (type === 'warmup') {
      return sessionExercise.showWarmupSets !== false;
    }
    if (type === 'cooldown') {
      return sessionExercise.showCooldownSets !== false;
    }
    return true;
  }

  // Sessions saved before exerciseType/incrementScheme existed (or generated
  // from a plan exercise whose config never set one) leave the field
  // undefined - default the *display* to Weight-Based/None without writing
  // anything, so the Increment Scheme dropdown still appears rather than
  // staying hidden until the user happens to reselect Weight-Based manually.
  sessionExerciseTypeDisplay(sessionExercise: SessionExercise): PlanExerciseType {
    return sessionExercise.exerciseType ?? 'WEIGHT_BASED';
  }

  sessionIncrementSchemeDisplay(sessionExercise: SessionExercise): IncrementScheme {
    return sessionExercise.incrementScheme ?? 'NONE';
  }

  // Reuses the Config page's own scheme descriptions rather than duplicating
  // them for the tooltip, so the two stay in sync automatically.
  incrementSchemeTooltipKey(sessionExercise: SessionExercise): string {
    switch (this.sessionIncrementSchemeDisplay(sessionExercise)) {
      case 'DOUBLE_PROGRESSION':
        return 'config.incrementSchemeDescription';
      case 'REP_GOAL':
        return 'config.repGoalDescription';
      case 'WAVE_PROGRESSION':
        return 'config.waveProgressionDescription';
      case 'LINEAR_PROGRESSION':
        return 'config.linearProgressionDescription';
      default:
        return 'sessions.incrementSchemeNoneTooltip';
    }
  }

  private countedSets(sessionExercise: SessionExercise): ExerciseSet[] {
    return sessionExercise.sets.filter((set) => {
      if (set.type === 'warmup') {
        return sessionExercise.countWarmupSets;
      }
      if (set.type === 'cooldown') {
        return sessionExercise.countCooldownSets;
      }
      return true;
    });
  }

  totalSetsCount(sessionExercise: SessionExercise): number {
    return this.countedSets(sessionExercise).length;
  }

  // null while any set is still open; once every set is done, 'success' if
  // each one's achieved reps met its target (sets without a target - e.g.
  // Rep Goal System sets, which are logged freely - can't fail), otherwise
  // 'fail'.
  exerciseCompletionStatus(sessionExercise: SessionExercise): 'success' | 'fail' | null {
    const sets = sessionExercise.sets;
    if (sets.length === 0 || !sets.every((set) => set.done)) {
      return null;
    }
    const allMet = sets.every((set) => set.targetReps === undefined || set.reps >= set.targetReps);
    return allMet ? 'success' : 'fail';
  }

  private exerciseWeightLifted(sessionExercise: SessionExercise): number {
    return this.countedSets(sessionExercise)
      .filter((set) => set.done)
      .reduce((sum, set) => sum + set.reps * set.weight, 0);
  }

  totalWeightLifted(sessionExercise: SessionExercise): string {
    return this.exerciseWeightLifted(sessionExercise).toFixed(2);
  }

  sessionWeightLifted(session: TrainingSession): string {
    const total = session.exercises.reduce(
      (sum, sessionExercise) => sum + this.exerciseWeightLifted(sessionExercise),
      0
    );
    return total.toFixed(2);
  }

  private bodyWeightReferenceDate(session: TrainingSession): string {
    return session.startedAt ?? session.date;
  }

  private sessionBodyWeightLookup(session: TrainingSession): BodyWeightLookupResult | null {
    return findBodyWeightForDate(new Date(this.bodyWeightReferenceDate(session)), this.bodyWeightEntries);
  }

  sessionBodyWeight(session: TrainingSession): string | null {
    const result = this.sessionBodyWeightLookup(session);
    if (result === null) {
      return null;
    }
    if (!result.isFallback || this.confirmedBodyWeightFallbackSessionIds.has(session.id)) {
      return result.entry.weight.toFixed(2);
    }
    return null;
  }

  bodyWeightFallbackCandidate(session: TrainingSession): string | null {
    if (this.confirmedBodyWeightFallbackSessionIds.has(session.id) || this.declinedBodyWeightFallbackSessionIds.has(session.id)) {
      return null;
    }
    const result = this.sessionBodyWeightLookup(session);
    return result !== null && result.isFallback ? result.entry.weight.toFixed(2) : null;
  }

  // The fallback-confirm prompt should only appear once the session is
  // started/resumed (see toggleTimer), never just from expanding the panel.
  shouldShowBodyWeightFallbackPrompt(session: TrainingSession): boolean {
    return this.promptedBodyWeightFallbackSessionIds.has(session.id) && this.bodyWeightFallbackCandidate(session) !== null;
  }

  confirmBodyWeightFallback(session: TrainingSession): void {
    this.confirmedBodyWeightFallbackSessionIds.add(session.id);
  }

  declineBodyWeightFallback(session: TrainingSession): void {
    this.declinedBodyWeightFallbackSessionIds.add(session.id);
  }

  // Unchecking a per-exercise counting/showing option also unchecks that
  // same option in the session-level popup's buffer, so the session popup
  // never keeps showing a setting as on once at least one exercise no
  // longer has it.
  async onCountingPreferenceChange(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    field: 'countWarmupSets' | 'countCooldownSets' | 'showWarmupSets' | 'showCooldownSets'
  ): Promise<void> {
    if (sessionExercise[field] === false) {
      this.sessionSettingsBuffer(session)[field] = false;
    }
    await this.persist(session);
  }

  // Yes/No button pair for the exercise's own Sätze tab (unlike the
  // session-wide popup's same-shaped buttons, these reflect and set this
  // one exercise's current value, not broadcast to every exercise).
  async updateSessionExercisePreference(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    field: 'countWarmupSets' | 'countCooldownSets' | 'showWarmupSets' | 'showCooldownSets',
    value: boolean
  ): Promise<void> {
    sessionExercise[field] = value;
    await this.onCountingPreferenceChange(session, sessionExercise, field);
  }

  async updateSessionExerciseType(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    exerciseType: PlanExerciseType
  ): Promise<void> {
    sessionExercise.exerciseType = exerciseType;
    await this.persist(session);
  }

  async updateSessionIncrementScheme(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    incrementScheme: IncrementScheme
  ): Promise<void> {
    sessionExercise.incrementScheme = incrementScheme;
    await this.persist(session);
  }

  // Linear Progression has no Config-level default (unlike the other three
  // schemes) - a plan exercise sets its target reps directly, and this is
  // the session-level equivalent for a manual session's exercise.
  async updateSessionMinReps(session: TrainingSession, sessionExercise: SessionExercise, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    sessionExercise.minReps = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : undefined;
    await this.persist(session);
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

  onDeloadPercentFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateSessionDeloadAfterFailures(session: TrainingSession, sessionExercise: SessionExercise, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    sessionExercise.deloadAfterFailures = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1000) : undefined;
    await this.persist(session);
  }

  // Displayed with trailing zeros (e.g. "5.00"), same convention as the
  // training-plans version of this field.
  sessionDeloadPercentDisplay(sessionExercise: SessionExercise): string {
    return sessionExercise.deloadPercent !== undefined ? sessionExercise.deloadPercent.toFixed(2) : '';
  }

  async updateSessionDeloadPercent(session: TrainingSession, sessionExercise: SessionExercise, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    sessionExercise.deloadPercent = Number.isFinite(parsed) ? Math.round(Math.min(Math.max(parsed, 0), 100) * 100) / 100 : undefined;
    await this.persist(session);
  }

  // Shown as the weight-increment field's own placeholder, same as the
  // training-plans version of this field.
  readonly defaultWeightIncrement = DEFAULT_WEIGHT_INCREMENT;

  sessionWeightIncrementDisplay(sessionExercise: SessionExercise): string {
    return sessionExercise.weightIncrement !== undefined ? sessionExercise.weightIncrement.toFixed(2) : '';
  }

  async updateSessionWeightIncrement(session: TrainingSession, sessionExercise: SessionExercise, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    sessionExercise.weightIncrement = Number.isFinite(parsed) ? Math.round(Math.max(parsed, 0) * 100) / 100 : DEFAULT_WEIGHT_INCREMENT;
    await this.persist(session);
  }

  async addSet(session: TrainingSession, sessionExercise: SessionExercise, type: SetType): Promise<void> {
    // Prefers the exercise's own previous set of this type in this session -
    // a much closer guess than defaultReps/defaultWeight's cross-session
    // history lookup, which only kicks in for the very first set of a type.
    const previousSet = [...sessionExercise.sets].reverse().find((candidate) => candidate.type === type);
    let reps: number;
    let weight: number;
    if (previousSet) {
      // Reads through the previous set's own field buffer rather than its
      // model fields directly - reps/weight only land on the model once a
      // set is confirmed done, so an in-progress previous set would
      // otherwise still show 0 here even though the user has already typed
      // (and can see) real values for it.
      const buffer = this.fieldBuffer(previousSet);
      const bufferedReps = parseInt(buffer.reps, 10);
      const bufferedWeight = parseFloat(buffer.weight.replace(',', '.'));
      reps = Number.isFinite(bufferedReps) ? bufferedReps : previousSet.reps;
      weight = Number.isFinite(bufferedWeight) ? bufferedWeight : previousSet.weight;
    } else {
      reps = this.defaultReps(sessionExercise.exerciseId, type, sessionExercise.minReps);
      weight = this.defaultWeight(sessionExercise.exerciseId, type, sessionExercise.minWeight);
    }
    const newSet: ExerciseSet = { id: crypto.randomUUID(), reps, weight, type };
    if (previousSet?.targetReps !== undefined) {
      newSet.targetReps = previousSet.targetReps;
      newSet.targetRepsMax = previousSet.targetRepsMax;
      newSet.isAmrap = previousSet.isAmrap;
    }
    sessionExercise.sets = [...sessionExercise.sets, newSet];
    await this.persist(session);
  }

  requestRemoveSet(setId: string): void {
    this.pendingDeleteSetId = setId;
  }

  cancelRemoveSet(): void {
    this.pendingDeleteSetId = null;
  }

  async confirmRemoveSet(session: TrainingSession, sessionExercise: SessionExercise, setId: string): Promise<void> {
    this.pendingDeleteSetId = null;
    await this.removeSet(session, sessionExercise, setId);
  }

  async removeSet(session: TrainingSession, sessionExercise: SessionExercise, setId: string): Promise<void> {
    sessionExercise.sets = sessionExercise.sets.filter((set) => set.id !== setId);
    await this.persist(session);
  }

  // Reps and weight are edited directly in the set row via a small per-set
  // text buffer, so typing doesn't touch the persisted set until the user
  // explicitly confirms it - matching the reps circle interaction this
  // replaced, where a value only became "done" on deliberate confirmation.
  private fieldBuffers = new Map<string, { reps: string; weight: string }>();

  fieldBuffer(set: ExerciseSet, sessionExercise?: SessionExercise): { reps: string; weight: string } {
    let buffer = this.fieldBuffers.get(set.id);
    if (!buffer) {
      // Prefill with the target reps (the top of the range, if there is
      // one) so hitting the target needs no typing at all - just confirm.
      const reps = !set.done && set.targetReps !== undefined ? (set.targetRepsMax ?? set.targetReps) : set.reps;
      buffer = { reps: String(reps), weight: this.initialSetWeight(set, sessionExercise).toFixed(2) };
      this.fieldBuffers.set(set.id, buffer);
    }
    return buffer;
  }

  // An un-done Percentage-Based set's weight is recomputed here from the
  // exercise's CURRENT 1RM (custom override respected) rather than read from
  // the frozen value percentageBasedWorkingSets stored back when the session
  // was generated - so a 1RM change after generation but before this set is
  // logged is reflected instead of silently going stale. Every other case
  // (already done, not Percentage-Based, or no 1RM to compute from) just
  // keeps the set's own stored weight.
  private initialSetWeight(set: ExerciseSet, sessionExercise?: SessionExercise): number {
    if (!set.done && sessionExercise?.exerciseType === 'PERCENTAGE_BASED' && set.percentage !== undefined) {
      const oneRepMax = this.effectiveOneRepMax(sessionExercise.exerciseId);
      if (oneRepMax) {
        return this.percentageSetWeight(sessionExercise.exerciseId, set.percentage);
      }
    }
    return set.weight;
  }

  // The total load of a done set, shown in the weight field's own label.
  setVolume(set: ExerciseSet): number {
    const buffer = this.fieldBuffer(set);
    const reps = parseInt(buffer.reps, 10);
    const weight = parseFloat(buffer.weight.replace(',', '.'));
    const validReps = Number.isFinite(reps) ? reps : 0;
    const validWeight = Number.isFinite(weight) ? weight : 0;
    return Math.round(validReps * validWeight * 100) / 100;
  }

  onRepsFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 5);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  onWeightFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Leaving a weight field fills the same weight into every other not-yet-
  // done set of the same type (warm-up/working/cooldown) in this exercise
  // that still has no weight of its own (0), so a shared weight only needs
  // to be typed once per group of sets without clobbering ones already set.
  // Also reformats the just-edited field itself to trailing-zero form (e.g.
  // "82.5" -> "82.50"), matching every other weight field's display.
  onWeightFieldBlur(sessionExercise: SessionExercise, set: ExerciseSet): void {
    if (set.done) {
      return;
    }
    const weight = parseFloat(this.fieldBuffer(set).weight.replace(',', '.'));
    if (!Number.isFinite(weight)) {
      return;
    }
    this.fieldBuffer(set).weight = weight.toFixed(2);
    if (weight <= 0) {
      return;
    }
    for (const other of sessionExercise.sets) {
      if (other.id === set.id || other.type !== set.type || other.done) {
        continue;
      }
      const otherWeight = parseFloat(this.fieldBuffer(other).weight.replace(',', '.'));
      if (Number.isFinite(otherWeight) && otherWeight !== 0) {
        continue;
      }
      this.fieldBuffer(other).weight = weight.toFixed(2);
    }
  }

  completeSet(session: TrainingSession, sessionExercise: SessionExercise, set: ExerciseSet): void {
    if (this.isPaused(session)) {
      return;
    }
    const buffer = this.fieldBuffer(set);
    const parsedReps = parseInt(buffer.reps, 10);
    set.reps = Number.isFinite(parsedReps) ? Math.min(Math.max(parsedReps, 0), 10000) : set.reps;
    const parsedWeight = parseFloat(buffer.weight.replace(',', '.'));
    set.weight = Number.isFinite(parsedWeight) ? Math.round(Math.min(Math.max(parsedWeight, 0), 9999) * 100) / 100 : set.weight;
    set.done = true;
    this.fieldBuffers.delete(set.id);
    void this.persist(session);
    void this.updateEstimatedOneRepMax(sessionExercise.exerciseId, set);
  }

  resetSet(session: TrainingSession, set: ExerciseSet): void {
    set.done = false;
    set.reps = 0;
    this.fieldBuffers.delete(set.id);
    void this.persist(session);
  }

  // Shown in the exercise header - the exercise's current 1RM (custom
  // override respected, same as what Percentage-Based generation itself
  // uses), not just the raw auto-estimated value, so the header still shows
  // a number for an exercise whose 1RM comes entirely from a custom
  // override with no logged history of its own yet.
  exerciseOneRepMax(exerciseId: string): number | undefined {
    return this.effectiveOneRepMax(exerciseId);
  }

  // Which symbol the exercise header's 1RM figure should use - "≈" for an
  // auto-estimate, "=" for an exact custom override (same distinction
  // effectiveOneRepMax already makes when picking the value itself).
  exerciseOneRepMaxLabelKey(exerciseId: string): string {
    const exercise = this.exercises.find((e) => e.id === exerciseId);
    return exercise && oneRepMaxOverrideChecked(exercise) ? 'exercises.oneRepMaxCustom' : 'exercises.oneRepMaxEstimated';
  }

  // Shown in the working-set weight field's own label - how much of the
  // exercise's current 1RM (custom override respected, same as what
  // Percentage-Based generation itself uses) this set's weight is. Reads the
  // live field buffer (like setVolume) rather than set.weight, so it updates
  // as the weight is typed instead of only after the set is marked done.
  // Null hides it: no weight yet, or no 1RM to compare against.
  workingSetOneRepMaxPercentage(sessionExercise: SessionExercise, set: ExerciseSet): number | null {
    const weight = parseFloat(this.fieldBuffer(set, sessionExercise).weight.replace(',', '.'));
    if (!Number.isFinite(weight) || weight <= 0) {
      return null;
    }
    const oneRepMax = this.effectiveOneRepMax(sessionExercise.exerciseId);
    if (!oneRepMax) {
      return null;
    }
    return Math.round((weight / oneRepMax) * 100);
  }

  // The 1RM Percentage-Based progression actually calculates upcoming sets
  // from - see effectiveOneRepMax in one-rep-max.util for the custom-vs-
  // estimated fallback rule.
  private effectiveOneRepMax(exerciseId: string): number | undefined {
    const exercise = this.exercises.find((e) => e.id === exerciseId);
    return exercise ? computeEffectiveOneRepMax(exercise) : undefined;
  }

  private lastExecutedSetOfType(exerciseId: string, type: SetType): ExerciseSet | undefined {
    const finishedSessions = this.sessions
      .filter((session) => session.finished)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const session of finishedSessions) {
      const sessionExercise = session.exercises.find((candidate) => candidate.exerciseId === exerciseId);
      const setsOfType = sessionExercise?.sets.filter((set) => set.type === type) ?? [];
      if (setsOfType.length > 0) {
        return setsOfType[setsOfType.length - 1];
      }
    }
    return undefined;
  }

  // Same source as the placeholder shown once a field is cleared back to
  // empty: the last logged set of this type, falling back to the
  // configured minimum. Used to prefill new sets with a real, editable
  // value instead of leaving the fields at 0.
  private defaultReps(exerciseId: string, type: SetType, minReps?: number): number {
    const lastSet = this.lastExecutedSetOfType(exerciseId, type);
    return lastSet ? lastSet.reps : (minReps ?? 0);
  }

  private defaultWeight(exerciseId: string, type: SetType, minWeight?: number): number {
    const lastSet = this.lastExecutedSetOfType(exerciseId, type);
    return lastSet ? lastSet.weight : (minWeight ?? 0);
  }

  // Shown next to the reps field for as long as a target exists, so it stays
  // visible as a point of reference even once the set is done - as a range
  // when the target was a from-to range, with a trailing "+" for an AMRAP
  // top set.
  targetRepsHint(set: ExerciseSet): string | null {
    if (set.targetReps === undefined) {
      return null;
    }
    const base =
      set.targetRepsMax !== undefined && set.targetRepsMax !== set.targetReps
        ? `${set.targetReps}-${set.targetRepsMax}`
        : String(set.targetReps);
    return set.isAmrap ? `${base}+` : base;
  }

  setMetTarget(set: ExerciseSet): boolean {
    return set.targetReps === undefined || set.reps >= set.targetReps;
  }

  // Editable counterpart to targetRepsHint, for sets in non-default sessions
  // where the user prescribes the target themselves instead of it coming
  // from a plan. Same textual shape ("8-12", "10", "8-12+", "10+").
  targetRepsInputValue(set: ExerciseSet): string {
    return this.targetRepsHint(set) ?? '';
  }

  onTargetRepsFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,3}(-\d{0,3})?\+?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Applies to every not-yet-done set of the exercise, not just the one just
  // edited - a rep prescription describes the whole exercise, and sets
  // already marked done keep whatever they were actually prescribed at the
  // time. Also keeps minReps (Linear Progression's target - see
  // recordManualProgressionProgress) in lockstep with the top of whatever
  // was just typed here, since that's the same number a manual session's
  // "hit the top of your range" target represents.
  // Shared by this component's own target-reps field and by
  // buildSessionFromPlan when seeding a working set's target straight from
  // a plan's own working-set-target text (same format: plain number, a
  // from-to range, either optionally suffixed with '+' for AMRAP).
  private parseTargetRepsText(text: string): { targetReps?: number; targetRepsMax?: number; isAmrap?: boolean } {
    const trimmed = text.trim();
    if (trimmed === '') {
      return {};
    }
    const match = trimmed.match(/^(\d{1,3})(?:-(\d{1,3}))?(\+)?$/);
    if (!match) {
      return {};
    }
    const lower = Math.min(Math.max(parseInt(match[1], 10), 1), 999);
    const upper = match[2] !== undefined ? Math.min(Math.max(parseInt(match[2], 10), 1), 999) : undefined;
    const targetReps = upper !== undefined ? Math.min(lower, upper) : lower;
    const targetRepsMax = upper !== undefined && upper !== lower ? Math.max(lower, upper) : undefined;
    return { targetReps, targetRepsMax, isAmrap: !!match[3] };
  }

  async updateTargetReps(session: TrainingSession, sessionExercise: SessionExercise, value: string): Promise<void> {
    const trimmed = value.trim();
    if (trimmed !== '' && this.parseTargetRepsText(trimmed).targetReps === undefined) {
      return;
    }
    const { targetReps, targetRepsMax, isAmrap } = this.parseTargetRepsText(trimmed);
    if (targetReps !== undefined) {
      sessionExercise.minReps = targetRepsMax ?? targetReps;
    }

    for (const candidate of sessionExercise.sets) {
      if (candidate.done) {
        continue;
      }
      candidate.targetReps = targetReps;
      candidate.targetRepsMax = targetRepsMax;
      candidate.isAmrap = isAmrap;
      // Prefills the achieved-reps field with the top of the prescription -
      // e.g. "8-12" or "10+" both prefill 10/12, so hitting the target needs
      // no typing at all, just confirming the set.
      if (targetReps !== undefined) {
        this.fieldBuffer(candidate).reps = String(targetRepsMax ?? targetReps);
      }
    }

    await this.persist(session);
  }

  private async updateEstimatedOneRepMax(exerciseId: string, set: ExerciseSet): Promise<void> {
    const oneRepMax = estimateOneRepMax(set.weight, set.reps);
    if (oneRepMax <= 0) {
      return;
    }
    const exercise = this.exercises.find((candidate) => candidate.id === exerciseId);
    if (!exercise) {
      return;
    }
    exercise.oneRepMax = oneRepMax;
    await this.exercisesService.update(exercise);
  }

  async updateSessionNotes(session: TrainingSession): Promise<void> {
    await this.persist(session);
  }

  async updateSessionName(session: TrainingSession): Promise<void> {
    await this.persist(session);
  }

  onSessionNameFocus(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  requestDeleteSession(id: string): void {
    this.pendingDeleteSessionId = id;
  }

  cancelDeleteSession(): void {
    this.pendingDeleteSessionId = null;
  }

  async confirmDeleteSession(session: TrainingSession): Promise<void> {
    this.pendingDeleteSessionId = null;
    await this.deleteSession(session.id);
  }

  async deleteSession(id: string): Promise<void> {
    if (this.unsavedSessionIds.has(id)) {
      this.unsavedSessionIds.delete(id);
      this.sessions = this.sessions.filter((session) => session.id !== id);
      return;
    }
    await this.sessionsService.delete(id);
    await this.load();
  }

  requestDeleteAllSessions(): void {
    this.pendingDeleteAllSessions = true;
  }

  cancelDeleteAllSessions(): void {
    this.pendingDeleteAllSessions = false;
  }

  async confirmDeleteAllSessions(): Promise<void> {
    this.pendingDeleteAllSessions = false;
    const savedIds = this.sessions.filter((session) => !this.unsavedSessionIds.has(session.id)).map((session) => session.id);
    this.unsavedSessionIds.clear();
    await Promise.all(savedIds.map((id) => this.sessionsService.delete(id)));
    await this.load();
  }

  cancelReplenish(): void {
    this.pendingReplenishSession = null;
  }

  async confirmReplenish(): Promise<void> {
    const session = this.pendingReplenishSession;
    this.pendingReplenishSession = null;
    if (!session) {
      return;
    }
    await this.replenishSession(session);
    // "ask" mode defers replenishment past confirmFinishSession's own sweep,
    // so the session created here needs its own pass to be covered too.
    await this.refreshUpcomingSessionsWeights(session);
  }
}
