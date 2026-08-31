import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  WaveProgressionConfig,
  PlanExerciseType,
  IncrementScheme
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
import { estimateOneRepMax } from '../core/utils/one-rep-max.util';
import { parseRepsRange } from '../core/utils/reps-range.util';
import { findBodyWeightForDate, BodyWeightLookupResult } from '../core/utils/body-weight-lookup.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
    MatCheckboxModule,
    MatTooltipModule,
    DatePipe,
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
  pendingReplenishSession: TrainingSession | null = null;
  finishBlockedSessionId: string | null = null;
  pausedAttemptFieldKey: string | null = null;
  private pausedAttemptTimeoutId?: ReturnType<typeof setTimeout>;
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
    if (this.pausedAttemptTimeoutId) {
      clearTimeout(this.pausedAttemptTimeoutId);
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
  }

  isWeightInfoOpen(sessionId: string, exerciseId: string): boolean {
    return this.weightInfoOpenKey === `${sessionId}:${exerciseId}`;
  }

  private closeWeightInfo(): void {
    this.weightInfoOpenKey = null;
    this.weightInfoPosition = null;
  }

  private exerciseSettingsInfoOpenKey: string | null = null;
  exerciseSettingsInfoPosition: { top: number; left: number } | null = null;

  toggleExerciseSettingsInfo(sessionId: string, exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    const key = `${sessionId}:${exerciseId}`;
    if (this.exerciseSettingsInfoOpenKey === key) {
      this.closeExerciseSettingsInfo();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const popupWidth = 280;
    this.exerciseSettingsInfoPosition = {
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - popupWidth)
    };
    this.exerciseSettingsInfoOpenKey = key;
  }

  isExerciseSettingsInfoOpen(sessionId: string, exerciseId: string): boolean {
    return this.exerciseSettingsInfoOpenKey === `${sessionId}:${exerciseId}`;
  }

  private closeExerciseSettingsInfo(): void {
    this.exerciseSettingsInfoOpenKey = null;
    this.exerciseSettingsInfoPosition = null;
  }

  // Closes an open popup on any other click in the app (a different button,
  // an input, a panel toggle, etc.). Registered on the capture phase so it
  // runs before target handlers that call stopPropagation() elsewhere in
  // this component (e.g. the delete-confirm buttons) — a bubble-phase
  // listener would never see those clicks.
  private readonly handleDocumentClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (this.weightInfoOpenKey && !target?.closest('.weight-info-trigger')) {
      this.closeWeightInfo();
    }
    if (this.exerciseSettingsInfoOpenKey && !target?.closest('.exercise-settings-info-trigger')) {
      this.closeExerciseSettingsInfo();
    }
    if (this.repsEditSetId && !target?.closest('.reps-edit-trigger')) {
      this.closeRepsEdit();
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

  private async getOrInitDoubleProgressionState(exerciseId: string): Promise<DoubleProgressionState> {
    const cached = this.doubleProgressionStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.doubleProgressionService.getState(exerciseId);
    const state = existing ?? (await this.doubleProgressionService.initState(exerciseId, 0));
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
        category
      );
      this.doubleProgressionStates.set(sessionExercise.exerciseId, next);
    }
  }

  private async getOrInitRepGoalState(exerciseId: string): Promise<RepGoalState> {
    const cached = this.repGoalStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.repGoalService.getState(exerciseId);
    const state = existing ?? (await this.repGoalService.initState(exerciseId, 0));
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
        category
      );
      this.repGoalStates.set(sessionExercise.exerciseId, next);
    }
  }

  private async getOrInitWaveProgressionState(
    exerciseId: string,
    config: WaveProgressionConfig
  ): Promise<WaveProgressionState> {
    const cached = this.waveProgressionStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.waveProgressionService.getState(exerciseId);
    const state = existing ?? (await this.waveProgressionService.initState(exerciseId, config.initialReps, 0));
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
        category
      );
      this.waveProgressionStates.set(sessionExercise.exerciseId, next);
    }
  }

  private async getOrInitLinearProgressionState(exerciseId: string): Promise<LinearProgressionState> {
    const cached = this.linearProgressionStates.get(exerciseId);
    if (cached) {
      return cached;
    }
    const existing = await this.linearProgressionService.getState(exerciseId);
    const state = existing ?? (await this.linearProgressionService.initState(exerciseId, 0));
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
      const achievedReps = workingSets.map((set) => set.reps);
      const lastSetWeight = workingSets[workingSets.length - 1].weight;
      const category =
        this.exercises.find((exercise) => exercise.id === sessionExercise.exerciseId)?.weightCategory ?? 'UPPER_BODY';
      const next = await this.linearProgressionService.recordSessionResult(
        sessionExercise.exerciseId,
        config.linearProgression,
        { achievedReps, lastSetWeight },
        category
      );
      this.linearProgressionStates.set(sessionExercise.exerciseId, next);
    }
  }

  isPaused(session: TrainingSession): boolean {
    return !session.finished && !session.timerRunning;
  }

  notePausedInputAttempt(session: TrainingSession, event: Event, fieldKey: string): void {
    if (!this.isPaused(session)) {
      return;
    }
    (event.target as HTMLElement).blur();
    this.pausedAttemptFieldKey = fieldKey;
    if (this.pausedAttemptTimeoutId) {
      clearTimeout(this.pausedAttemptTimeoutId);
    }
    this.pausedAttemptTimeoutId = setTimeout(() => {
      this.pausedAttemptFieldKey = null;
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
      startedAt: undefined,
      finished: false
    };
    this.unsavedSessionIds.add(session.id);
    this.autoExpandedSessionIds.add(session.id);
    this.sessions = [...this.sessions, session];
    void this.persist(session);
  }

  private buildManualReplenishment(sourceSession: TrainingSession): TrainingSession {
    const now = new Date();
    const sessionWord = this.translationService.translate('sessions.defaultName');
    const name = `${sessionWord} ${this.datePipe.transform(now, this.dateFormat)}`;
    const exercises: SessionExercise[] = sourceSession.exercises.map((sessionExercise) => ({
      exerciseId: sessionExercise.exerciseId,
      sets: sessionExercise.sets.map((set) => ({
        id: crypto.randomUUID(),
        reps: this.defaultReps(sessionExercise.exerciseId, set.type, sessionExercise.minReps),
        weight: this.defaultWeight(sessionExercise.exerciseId, set.type, sessionExercise.minWeight),
        type: set.type
      })),
      countWarmupSets: sessionExercise.countWarmupSets,
      countCooldownSets: sessionExercise.countCooldownSets,
      showWarmupSets: sessionExercise.showWarmupSets,
      showCooldownSets: sessionExercise.showCooldownSets,
      exerciseType: sessionExercise.exerciseType,
      incrementScheme: sessionExercise.incrementScheme,
      minReps: sessionExercise.minReps,
      minWeight: sessionExercise.minWeight
    }));
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
        : [await this.buildSessionFromPlan(plan, null, baseSequence)];
    for (const session of newSessions) {
      this.unsavedSessionIds.add(session.id);
    }
    this.sessions = [...this.sessions, ...newSessions];
    for (const session of newSessions) {
      await this.persist(session);
    }
  }

  private async buildSessionFromPlan(
    plan: TrainingPlan,
    planSession: TierLinePlanSession | null,
    sequence: number
  ): Promise<TrainingSession> {
    const now = new Date();
    const name = planSession ? `${plan.name} – ${planSession.name}` : plan.name;
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
                showWarmupSets: true,
                showCooldownSets: true
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
              showWarmupSets: true,
              showCooldownSets: true
            };
          })
        )
      : await Promise.all(
          plan.exerciseIds.map(async (exerciseId) => {
            const config = plan.exerciseConfigs?.find((c) => c.exerciseId === exerciseId);
            if (!config) {
              return {
                exerciseId,
                sets: [],
                countWarmupSets: true,
                countCooldownSets: true,
                showWarmupSets: true,
                showCooldownSets: true
              };
            }
            const buildSets = (count: number, type: SetType) =>
              Array.from({ length: count }, () => ({
                id: crypto.randomUUID(),
                reps: this.defaultReps(exerciseId, type),
                weight: this.defaultWeight(exerciseId, type),
                type
              }));

            const hasIncrementScheme = config.exerciseType === 'WEIGHT_BASED';
            let workingSets: SessionExercise['sets'];
            if (hasIncrementScheme && config.incrementScheme === 'DOUBLE_PROGRESSION' && config.doubleProgression) {
              const state = await this.getOrInitDoubleProgressionState(exerciseId);
              const prescribedReps = computePrescribedReps(config.doubleProgression, state.repsAddedThisCycle, config.workingSets);
              workingSets = prescribedReps.map((reps) => ({
                id: crypto.randomUUID(),
                reps,
                targetReps: reps,
                weight: state.currentWeight,
                type: 'working' as SetType
              }));
            } else if (hasIncrementScheme && config.incrementScheme === 'REP_GOAL' && config.repGoal) {
              // No prescribed reps per set - each working set is pushed close
              // to failure and logged freely; only the tracked weight carries
              // over from session to session.
              const state = await this.getOrInitRepGoalState(exerciseId);
              workingSets = Array.from({ length: config.workingSets }, () => ({
                id: crypto.randomUUID(),
                reps: 0,
                weight: state.currentWeight,
                type: 'working' as SetType
              }));
            } else if (hasIncrementScheme && config.incrementScheme === 'WAVE_PROGRESSION' && config.waveProgression) {
              const state = await this.getOrInitWaveProgressionState(exerciseId, config.waveProgression);
              workingSets = Array.from({ length: config.workingSets }, () => ({
                id: crypto.randomUUID(),
                reps: state.currentReps,
                targetReps: state.currentReps,
                weight: state.currentWeight,
                type: 'working' as SetType
              }));
            } else if (hasIncrementScheme && config.incrementScheme === 'LINEAR_PROGRESSION' && config.linearProgression) {
              const state = await this.getOrInitLinearProgressionState(exerciseId);
              // Prefilled with the range's lower bound regardless of
              // lowerBoundSufficient - that flag only affects what counts as
              // a success, not what's prescribed going in.
              const targetRepsRange = parseRepsRange(config.linearProgression.targetReps);
              workingSets = Array.from({ length: config.workingSets }, () => ({
                id: crypto.randomUUID(),
                reps: targetRepsRange.min,
                targetReps: targetRepsRange.min,
                targetRepsMax: targetRepsRange.max !== targetRepsRange.min ? targetRepsRange.max : undefined,
                weight: state.currentWeight,
                type: 'working' as SetType
              }));
            } else {
              workingSets = buildSets(config.workingSets, 'working');
            }

            return {
              exerciseId,
              sets: [...buildSets(config.warmupSets, 'warmup'), ...workingSets, ...buildSets(config.cooldownSets, 'cooldown')],
              countWarmupSets: true,
              countCooldownSets: true,
              showWarmupSets: true,
              showCooldownSets: true,
              exerciseType: config.exerciseType,
              incrementScheme: config.incrementScheme
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
      : this.buildManualReplenishment(sourceSession);
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
    return this.buildSessionFromPlan(plan, planSession, Date.now());
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

    const mode = this.settingsService.getSettings().finishedSessionReplenishMode;
    if (mode === 'always') {
      await this.replenishSession(session);
    } else if (mode === 'ask') {
      this.pendingReplenishSession = session;
    }
  }

  async updateSessionExercises(session: TrainingSession, exerciseIds: string[]): Promise<void> {
    const existingByExerciseId = new Map(
      session.exercises.map((sessionExercise) => [sessionExercise.exerciseId, sessionExercise])
    );
    session.exercises = exerciseIds.map(
      (exerciseId) =>
        existingByExerciseId.get(exerciseId) ?? {
          exerciseId,
          sets: [],
          countWarmupSets: true,
          countCooldownSets: true,
          showWarmupSets: true,
          showCooldownSets: true,
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
    return this.countedSets(sessionExercise).reduce((sum, set) => sum + set.reps * set.weight, 0);
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

  async onCountingPreferenceChange(session: TrainingSession): Promise<void> {
    await this.persist(session);
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

  async addSet(session: TrainingSession, sessionExercise: SessionExercise, type: SetType): Promise<void> {
    const reps = this.defaultReps(sessionExercise.exerciseId, type, sessionExercise.minReps);
    const weight = this.defaultWeight(sessionExercise.exerciseId, type, sessionExercise.minWeight);
    sessionExercise.sets = [...sessionExercise.sets, { id: crypto.randomUUID(), reps, weight, type }];
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

  onRepsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 5);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Reps circle interaction: a short press (<500ms) toggles the set done/not
  // done using its current reps value, unless shortPressShouldEdit() says
  // that value can't be trusted as-is - then it opens the same popup a long
  // press (>=500ms) always opens, to change the reps before confirming done.
  private static readonly LONG_PRESS_MS = 500;
  private pressState = new Map<string, { timeoutId: number; rect: DOMRect }>();

  onSetPressStart(session: TrainingSession, sessionExercise: SessionExercise, set: ExerciseSet, event: PointerEvent): void {
    if (this.isPaused(session)) {
      this.notePausedInputAttempt(session, event, set.id);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const timeoutId = window.setTimeout(() => {
      this.pressState.delete(set.id);
      this.openRepsEdit(sessionExercise, set, rect);
    }, SessionsComponent.LONG_PRESS_MS);
    this.pressState.set(set.id, { timeoutId, rect });
  }

  onSetPressEnd(session: TrainingSession, sessionExercise: SessionExercise, set: ExerciseSet): void {
    const state = this.pressState.get(set.id);
    if (!state) {
      // Long press already fired and opened the edit popup - nothing further
      // to do on release.
      return;
    }
    clearTimeout(state.timeoutId);
    this.pressState.delete(set.id);
    if (this.shortPressShouldEdit(set)) {
      this.openRepsEdit(sessionExercise, set, state.rect);
      return;
    }
    set.done = !set.done;
    void this.persist(session);
  }

  onSetPressCancel(set: ExerciseSet): void {
    const state = this.pressState.get(set.id);
    if (state) {
      clearTimeout(state.timeoutId);
      this.pressState.delete(set.id);
    }
  }

  // A short tap normally just toggles done using whatever reps value is
  // already showing. Once a set is already done, a tap always just undoes
  // that (never reopens the popup) - it's only while a set is still open
  // that its current value might not be trustworthy yet: for an AMRAP set
  // there's no sensible default for "as many as possible", so it always
  // opens the edit popup; a ranged (non-AMRAP) target only needs that while
  // its reps haven't yet reached the top of the range, since once they have
  // there's nothing left to clarify.
  private shortPressShouldEdit(set: ExerciseSet): boolean {
    if (set.done) {
      return false;
    }
    if (set.isAmrap) {
      return true;
    }
    return set.targetRepsMax !== undefined && set.targetRepsMax !== set.targetReps && set.reps < set.targetRepsMax;
  }

  private repsEditSetId: string | null = null;
  repsEditPosition: { top: number; left: number } | null = null;
  repsEditValue = '';

  private openRepsEdit(sessionExercise: SessionExercise, set: ExerciseSet, rect: DOMRect): void {
    const popupWidth = 140;
    this.repsEditPosition = {
      top: rect.bottom + 8,
      left: Math.max(8, rect.left + rect.width / 2 - popupWidth / 2)
    };
    this.repsEditValue = set.reps === 0 ? this.repsPlaceholder(sessionExercise, set.type) : String(set.reps);
    this.repsEditSetId = set.id;
  }

  isRepsEditOpen(setId: string): boolean {
    return this.repsEditSetId === setId;
  }

  confirmRepsEdit(session: TrainingSession, sessionExercise: SessionExercise, set: ExerciseSet): void {
    const parsed = parseInt(this.repsEditValue, 10);
    set.reps = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 10000) : set.reps;
    set.done = true;
    this.closeRepsEdit();
    void this.persist(session);
    void this.updateEstimatedOneRepMax(sessionExercise.exerciseId, set);
  }

  discardRepsEdit(): void {
    this.closeRepsEdit();
  }

  resetSet(session: TrainingSession, set: ExerciseSet): void {
    set.done = false;
    set.reps = 0;
    this.closeRepsEdit();
    void this.persist(session);
  }

  private closeRepsEdit(): void {
    this.repsEditSetId = null;
    this.repsEditPosition = null;
  }

  exerciseOneRepMax(exerciseId: string): number | undefined {
    return this.exercises.find((exercise) => exercise.id === exerciseId)?.oneRepMax;
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

  repsPlaceholder(sessionExercise: SessionExercise, type: SetType): string {
    const lastSet = this.lastExecutedSetOfType(sessionExercise.exerciseId, type);
    if (lastSet) {
      return String(lastSet.reps);
    }
    return sessionExercise.minReps !== undefined ? String(sessionExercise.minReps) : '0';
  }

  // What the reps circle shows: the achieved reps once the set is done;
  // otherwise the reps still to be reached - as a range when the target was
  // a from-to range, with a trailing "+" for an AMRAP top set.
  repsCircleDisplay(sessionExercise: SessionExercise, set: ExerciseSet, type: SetType): string {
    if (set.done) {
      return String(set.reps);
    }
    if (set.targetReps === undefined) {
      return set.reps === 0 ? this.repsPlaceholder(sessionExercise, type) : String(set.reps);
    }
    return this.formattedTargetReps(set);
  }

  // 'targetReps' is guaranteed defined by both call sites below.
  private formattedTargetReps(set: ExerciseSet): string {
    const base =
      set.targetRepsMax !== undefined && set.targetRepsMax !== set.targetReps
        ? `${set.targetReps}-${set.targetRepsMax}`
        : String(set.targetReps);
    return set.isAmrap ? `${base}+` : base;
  }

  // Shown above the circle only once a set is done and its target was AMRAP
  // or a range - a plain fixed target isn't worth repeating since it's
  // exactly what the circle already showed while the set was still open.
  doneTargetLabel(set: ExerciseSet): string | null {
    if (!set.done || set.targetReps === undefined) {
      return null;
    }
    const isRange = set.targetRepsMax !== undefined && set.targetRepsMax !== set.targetReps;
    if (!set.isAmrap && !isRange) {
      return null;
    }
    return this.formattedTargetReps(set);
  }

  setMetTarget(set: ExerciseSet): boolean {
    return set.targetReps === undefined || set.reps >= set.targetReps;
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
  }
}
