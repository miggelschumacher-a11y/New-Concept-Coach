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
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';
import { TrainingPlan, TierLinePlanSession, TierLinePlanExercise } from '../core/models/training-plan.model';
import { TrainingMethodology, GzclTier, TierLineProgressionState } from '../core/models/tier-line-progression.model';
import { TIER_LINE_SCHEME } from '../core/data/tier-line-scheme';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from '../core/utils/tier-line-progression.util';
import { estimateOneRepMax } from '../core/utils/one-rep-max.util';
import { parseRepsRange } from '../core/utils/reps-range.util';
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

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly translationService: TranslationService,
    private readonly trainingPlansService: TrainingPlansService,
    private readonly tierLineProgressionService: TierLineProgressionService,
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
    await Promise.all([this.load(), this.loadExercises(), this.loadTrainingPlans(), this.loadProgressionStates()]);
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
    this.sessions = sessions.map((session) => ({ ...session, exercises: session.exercises ?? [] }));
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

  // Closes an open popup on any other click in the app (a different button,
  // an input, a panel toggle, etc.). Registered on the capture phase so it
  // runs before target handlers that call stopPropagation() elsewhere in
  // this component (e.g. the delete-confirm buttons) — a bubble-phase
  // listener would never see those clicks.
  private readonly handleDocumentClick = (event: MouseEvent): void => {
    if (!this.weightInfoOpenKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.weight-info-trigger')) {
      return;
    }
    this.closeWeightInfo();
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

  isPaused(session: TrainingSession): boolean {
    return !session.finished && !session.timerRunning;
  }

  notePausedInputAttempt(session: TrainingSession, event: FocusEvent, fieldKey: string): void {
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
        reps: 0,
        weight: 0,
        type: set.type
      })),
      countWarmupSets: sessionExercise.countWarmupSets,
      countCooldownSets: sessionExercise.countCooldownSets,
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
                sets: Array.from({ length: scheme.sets }, () => ({
                  id: crypto.randomUUID(),
                  reps: scheme.targetReps,
                  weight: state.currentWeight,
                  type: 'working' as SetType
                })),
                countWarmupSets: true,
                countCooldownSets: true
              };
            }
            // planExercise.targetReps may be a range ('8-12'); a session set
            // always holds a single number, so the lower bound is used.
            const targetReps = parseRepsRange(planExercise.targetReps).min;
            return {
              exerciseId: planExercise.exerciseId,
              sets: Array.from({ length: planExercise.sets }, () => ({
                id: crypto.randomUUID(),
                reps: targetReps,
                weight: 0,
                type: 'working' as SetType
              })),
              countWarmupSets: true,
              countCooldownSets: true
            };
          })
        )
      : plan.exerciseIds.map((exerciseId) => ({
          exerciseId,
          sets: [],
          countWarmupSets: true,
          countCooldownSets: true
        }));
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
          countCooldownSets: true
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

  async onCountingPreferenceChange(session: TrainingSession): Promise<void> {
    await this.persist(session);
  }

  async addSet(session: TrainingSession, sessionExercise: SessionExercise, type: SetType): Promise<void> {
    sessionExercise.sets = [...sessionExercise.sets, { id: crypto.randomUUID(), reps: 0, weight: 0, type }];
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

  async onRepsChange(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    set: ExerciseSet,
    value: string
  ): Promise<void> {
    const parsed = parseInt(value, 10);
    set.reps = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 10000) : 0;
    await this.persist(session);
    await this.updateEstimatedOneRepMax(sessionExercise.exerciseId, set);
  }

  onWeightInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d*[.,]?\d{0,2}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async onWeightChange(
    session: TrainingSession,
    sessionExercise: SessionExercise,
    set: ExerciseSet,
    value: string
  ): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    set.weight = Number.isFinite(parsed) ? Math.round(Math.max(parsed, 0) * 100) / 100 : 0;
    await this.persist(session);
    await this.updateEstimatedOneRepMax(sessionExercise.exerciseId, set);
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

  repsPlaceholder(sessionExercise: SessionExercise, type: SetType): string {
    const lastSet = this.lastExecutedSetOfType(sessionExercise.exerciseId, type);
    if (lastSet) {
      return String(lastSet.reps);
    }
    return sessionExercise.minReps !== undefined ? String(sessionExercise.minReps) : '0';
  }

  weightPlaceholder(sessionExercise: SessionExercise, type: SetType): string {
    const lastSet = this.lastExecutedSetOfType(sessionExercise.exerciseId, type);
    if (lastSet) {
      return lastSet.weight.toFixed(2);
    }
    return sessionExercise.minWeight !== undefined ? sessionExercise.minWeight.toFixed(2) : '0.00';
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
    this.pendingReplenishSession = session;
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
