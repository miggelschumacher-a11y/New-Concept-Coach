import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { BodyWeightService } from '../core/services/body-weight.service';
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';
import { BodyWeightEntry } from '../core/models/body-weight-entry.model';
import { findBodyWeightForDate } from '../core/utils/body-weight-lookup.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SET_TYPES } from '../sessions/sessions.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    DatePipe,
    TranslatePipe
  ],
  providers: [DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  readonly setTypes = SET_TYPES;
  sessions: TrainingSession[] = [];
  exercises: Exercise[] = [];
  bodyWeightEntries: BodyWeightEntry[] = [];
  pendingDeleteSessionId: string | null = null;

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly bodyWeightService: BodyWeightService
  ) {}

  get dateFormat(): string {
    return `${this.settingsService.getSettings().dateFormat}, HH:mm`;
  }

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  get finishedSessions(): TrainingSession[] {
    return this.sessions
      .filter((session) => session.finished)
      .sort((a, b) => this.sortKey(b) - this.sortKey(a));
  }

  private sortKey(session: TrainingSession): number {
    return session.sequence ?? new Date(session.date).getTime();
  }

  async ngOnInit(): Promise<void> {
    const [sessions, exercises, bodyWeightEntries] = await Promise.all([
      this.sessionsService.getAll(),
      this.exercisesService.getAll(),
      this.bodyWeightService.getAll()
    ]);
    this.sessions = sessions;
    this.exercises = exercises;
    this.bodyWeightEntries = bodyWeightEntries;
  }

  exerciseName(id: string): string {
    return this.exercises.find((exercise) => exercise.id === id)?.name ?? id;
  }

  sessionDuration(session: TrainingSession): string {
    const totalSeconds = Math.floor((session.timerElapsedMs ?? 0) / 1000);
    const pad = (value: number) => value.toString().padStart(2, '0');
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  sessionBodyWeight(session: TrainingSession): string | null {
    const referenceDate = session.startedAt ?? session.date;
    const result = findBodyWeightForDate(new Date(referenceDate), this.bodyWeightEntries);
    return result ? result.entry.weight.toFixed(2) : null;
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
    return this.countedSets(sessionExercise)
      .filter((set) => set.done)
      .reduce((sum, set) => sum + set.reps * set.weight, 0);
  }

  totalWeightLifted(sessionExercise: SessionExercise): string {
    return this.exerciseWeightLifted(sessionExercise).toFixed(2);
  }

  sessionWeightLifted(session: TrainingSession): string {
    return session.exercises.reduce((sum, sessionExercise) => sum + this.exerciseWeightLifted(sessionExercise), 0).toFixed(2);
  }

  // null while any set is still open; once every set is done, 'success' if
  // each one's achieved reps met its target, otherwise 'fail'. Mirrors
  // SessionsComponent.exerciseCompletionStatus.
  exerciseCompletionStatus(sessionExercise: SessionExercise): 'success' | 'fail' | null {
    const sets = sessionExercise.sets;
    if (sets.length === 0 || !sets.every((set) => set.done)) {
      return null;
    }
    const allMet = sets.every((set) => set.targetReps === undefined || set.reps >= set.targetReps);
    return allMet ? 'success' : 'fail';
  }

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

  requestDeleteSession(id: string): void {
    this.pendingDeleteSessionId = id;
  }

  cancelDeleteSession(): void {
    this.pendingDeleteSessionId = null;
  }

  async confirmDeleteSession(id: string): Promise<void> {
    this.pendingDeleteSessionId = null;
    await this.sessionsService.delete(id);
    this.sessions = this.sessions.filter((session) => session.id !== id);
  }
}
