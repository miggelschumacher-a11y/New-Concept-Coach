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
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';
import { TrainingPlan, TierLinePlanSession } from '../core/models/training-plan.model';
import { estimateOneRepMax } from '../core/utils/one-rep-max.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const SET_TYPES: { value: SetType; labelKey: string }[] = [
  { value: 'warmup', labelKey: 'sessions.warmupSets' },
  { value: 'working', labelKey: 'sessions.workingSets' },
  { value: 'cooldown', labelKey: 'sessions.cooldownSets' }
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
  finishBlockedSessionId: string | null = null;
  pausedAttemptFieldKey: string | null = null;
  private pausedAttemptTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly translationService: TranslationService,
    private readonly trainingPlansService: TrainingPlansService,
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

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadExercises(), this.loadTrainingPlans()]);
    this.timerTickerId = setInterval(() => {}, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerTickerId) {
      clearInterval(this.timerTickerId);
    }
    if (this.pausedAttemptTimeoutId) {
      clearTimeout(this.pausedAttemptTimeoutId);
    }
  }

  async load(): Promise<void> {
    this.sessions = await this.sessionsService.getAll();
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
      timerRunning: true,
      timerStartedAt: now.toISOString(),
      finished: false
    };
    this.unsavedSessionIds.add(session.id);
    this.autoExpandedSessionIds.add(session.id);
    this.sessions = [...this.sessions, session];
    void this.persist(session);
  }

  private buildBlankSession(): TrainingSession {
    const now = new Date();
    const sessionWord = this.translationService.translate('sessions.defaultName');
    const name = `${sessionWord} ${this.datePipe.transform(now, this.dateFormat)}`;
    return {
      id: crypto.randomUUID(),
      name,
      date: toDateTimeLocalValue(now),
      sequence: now.getTime(),
      exercises: [],
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
        ? plan.planSessions.map((planSession, index) =>
            this.buildSessionFromPlan(plan, planSession, baseSequence + index)
          )
        : [this.buildSessionFromPlan(plan, null, baseSequence)];
    for (const session of newSessions) {
      this.unsavedSessionIds.add(session.id);
    }
    this.sessions = [...this.sessions, ...newSessions];
    for (const session of newSessions) {
      await this.persist(session);
    }
  }

  private buildSessionFromPlan(
    plan: TrainingPlan,
    planSession: TierLinePlanSession | null,
    sequence: number
  ): TrainingSession {
    const now = new Date();
    const name = planSession ? `${plan.name} – ${planSession.name}` : plan.name;
    const exercises: SessionExercise[] = planSession
      ? planSession.exercises.map((planExercise) => ({
          exerciseId: planExercise.exerciseId,
          sets: Array.from({ length: planExercise.sets }, () => ({
            id: crypto.randomUUID(),
            reps: planExercise.targetReps,
            weight: 0,
            type: 'working' as SetType
          })),
          countWarmupSets: true,
          countCooldownSets: true
        }))
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

  private async replenishSession(finishedSession: TrainingSession): Promise<void> {
    const newSession = finishedSession.trainingPlanId
      ? this.buildPlanReplenishment(finishedSession)
      : this.buildBlankSession();
    if (!newSession) {
      return;
    }
    this.unsavedSessionIds.add(newSession.id);
    this.sessions = [...this.sessions, newSession];
    await this.persist(newSession);
  }

  private buildPlanReplenishment(finishedSession: TrainingSession): TrainingSession | null {
    const plan = this.trainingPlans.find((p) => p.id === finishedSession.trainingPlanId);
    if (!plan) {
      return null;
    }
    const planSession = finishedSession.planSessionId
      ? (plan.planSessions?.find((ps) => ps.id === finishedSession.planSessionId) ?? null)
      : null;
    if (finishedSession.planSessionId && !planSession) {
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
    await this.replenishSession(session);
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

  async onRepsChange(session: TrainingSession, sessionExercise: SessionExercise, set: ExerciseSet): Promise<void> {
    set.reps = Math.min(Math.max(set.reps, 0), 10000);
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

  async confirmDeleteSession(id: string): Promise<void> {
    this.pendingDeleteSessionId = null;
    await this.deleteSession(id);
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
}
