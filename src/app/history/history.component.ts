import { Component, OnInit } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { BodyWeightService } from '../core/services/body-weight.service';
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';
import { BodyWeightEntry } from '../core/models/body-weight-entry.model';
import { findBodyWeightForDate } from '../core/utils/body-weight-lookup.util';
import { estimateOneRepMax } from '../core/utils/one-rep-max.util';
import { TranslationService } from '../core/services/translation.service';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SET_TYPES } from '../sessions/sessions.component';

interface ExerciseChartPoint {
  date: Date;
  weight: number;
  oneRepMax: number;
}

interface BodyWeightChartPoint {
  date: Date;
  weight: number;
}

interface ChartCoord {
  x: number;
  y: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    DatePipe,
    NgTemplateOutlet,
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
  selectedChartExerciseId: string | null = null;

  private readonly chartWidth = 600;
  private readonly chartHeight = 260;
  private readonly chartPadding = { top: 16, right: 16, bottom: 28, left: 48 };

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService,
    private readonly bodyWeightService: BodyWeightService,
    private readonly translationService: TranslationService,
    private readonly datePipe: DatePipe
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
    this.selectedChartExerciseId = this.exercisesWithHistory[0]?.id ?? null;
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

  // Only exercises that have at least one completed working set in some
  // finished session show up in the chart picker - every other exercise has
  // nothing to plot.
  get exercisesWithHistory(): Exercise[] {
    const idsWithHistory = new Set(
      this.finishedSessions.flatMap((session) =>
        session.exercises
          .filter((sessionExercise) => sessionExercise.sets.some((set) => set.type === 'working' && set.done))
          .map((sessionExercise) => sessionExercise.exerciseId)
      )
    );
    return this.exercises.filter((exercise) => idsWithHistory.has(exercise.id));
  }

  get selectedChartPoints(): ExerciseChartPoint[] {
    return this.selectedChartExerciseId ? this.chartPoints(this.selectedChartExerciseId) : [];
  }

  // Oldest first, one point per finished session that logged this exercise -
  // the point is the working set with the best estimated 1RM that session,
  // so the weight/1RM lines both trace the same set rather than mismatched
  // "heaviest weight this session" vs "best estimate this session" sets.
  private chartPoints(exerciseId: string): ExerciseChartPoint[] {
    return [...this.finishedSessions]
      .reverse()
      .map((session): ExerciseChartPoint | null => {
        const sessionExercise = session.exercises.find((exercise) => exercise.exerciseId === exerciseId);
        const doneWorkingSets = sessionExercise?.sets.filter((set) => set.type === 'working' && set.done) ?? [];
        if (doneWorkingSets.length === 0) {
          return null;
        }
        const bestSet = doneWorkingSets.reduce((best, set) =>
          estimateOneRepMax(set.weight, set.reps) > estimateOneRepMax(best.weight, best.reps) ? set : best
        );
        return {
          date: new Date(session.date),
          weight: bestSet.weight,
          oneRepMax: estimateOneRepMax(bestSet.weight, bestSet.reps)
        };
      })
      .filter((point): point is ExerciseChartPoint => point !== null);
  }

  private chartValueRange(values: number[]): { min: number; max: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.15 || Math.max(max * 0.1, 1);
    return { min: Math.max(0, min - pad), max: max + pad };
  }

  private chartX(index: number, count: number): number {
    const innerWidth = this.chartWidth - this.chartPadding.left - this.chartPadding.right;
    return count <= 1 ? this.chartPadding.left + innerWidth / 2 : this.chartPadding.left + (innerWidth * index) / (count - 1);
  }

  private chartY(value: number, range: { min: number; max: number }): number {
    const innerHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    const ratio = range.max === range.min ? 0.5 : (value - range.min) / (range.max - range.min);
    return this.chartPadding.top + innerHeight * (1 - ratio);
  }

  chartCoords(points: ExerciseChartPoint[], key: 'weight' | 'oneRepMax'): ChartCoord[] {
    const range = this.chartValueRange(points.flatMap((point) => [point.weight, point.oneRepMax]));
    return points.map((point, index) => ({ x: this.chartX(index, points.length), y: this.chartY(point[key], range) }));
  }

  chartPolylinePoints(coords: ChartCoord[]): string {
    return coords.map((coord) => `${coord.x},${coord.y}`).join(' ');
  }

  private gridLinesForValues(values: number[]): { y: number; label: string }[] {
    const range = this.chartValueRange(values);
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = range.min + ((range.max - range.min) * i) / steps;
      return { y: this.chartY(value, range), label: value.toFixed(1) };
    });
  }

  chartGridLines(points: ExerciseChartPoint[]): { y: number; label: string }[] {
    return this.gridLinesForValues(points.flatMap((point) => [point.weight, point.oneRepMax]));
  }

  chartPointLabel(point: ExerciseChartPoint): string {
    const dateText = this.datePipe.transform(point.date, this.settingsService.getSettings().dateFormat) ?? '';
    const oneRepMaxLabel = this.translationService.translate('history.chartOneRepMaxLegend');
    return `${dateText}: ${point.weight.toFixed(2)} ${this.weightUnitLabel} / ${oneRepMaxLabel} ${point.oneRepMax.toFixed(2)} ${this.weightUnitLabel}`;
  }

  // Oldest first, one point per logged body-weight entry - unlike the
  // exercise chart, this isn't tied to sessions at all.
  get bodyWeightChartPoints(): BodyWeightChartPoint[] {
    return [...this.bodyWeightEntries]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((entry) => ({ date: new Date(entry.timestamp), weight: entry.weight }));
  }

  bodyWeightChartCoords(points: BodyWeightChartPoint[]): ChartCoord[] {
    const range = this.chartValueRange(points.map((point) => point.weight));
    return points.map((point, index) => ({ x: this.chartX(index, points.length), y: this.chartY(point.weight, range) }));
  }

  bodyWeightChartGridLines(points: BodyWeightChartPoint[]): { y: number; label: string }[] {
    return this.gridLinesForValues(points.map((point) => point.weight));
  }

  bodyWeightPointLabel(point: BodyWeightChartPoint): string {
    const dateText = this.datePipe.transform(point.date, this.settingsService.getSettings().dateFormat) ?? '';
    return `${dateText}: ${point.weight.toFixed(2)} ${this.weightUnitLabel}`;
  }
}
