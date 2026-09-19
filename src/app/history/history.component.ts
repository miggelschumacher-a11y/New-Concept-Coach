import { Component, OnInit } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { BodyWeightService } from '../core/services/body-weight.service';
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';
import { BodyWeightEntry } from '../core/models/body-weight-entry.model';
import { findBodyWeightForDate } from '../core/utils/body-weight-lookup.util';
import { estimateOneRepMax, liftedWeight } from '../core/utils/one-rep-max.util';
import { isSetCounted } from '../core/utils/exercise-history.util';
import { TranslationService } from '../core/services/translation.service';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../core/directives/select-on-focus.directive';
import { SET_TYPES } from '../sessions/sessions.component';

interface ExerciseChartPoint {
  date: Date;
  weight: number;
  oneRepMax: number;
  // The single best (highest-estimated-1RM) chartable set's own reps/weight -
  // what the tooltip shows when the session only logged one such set, so
  // a lone set is never mislabeled as an "average" of itself (see
  // exerciseChartTooltip). allReps/averageWeight below are what it shows
  // instead once there's more than one to actually average.
  reps: number;
  allReps: number[];
  averageWeight: number;
}

interface BodyWeightChartPoint {
  date: Date;
  weight: number;
}

interface ChartCoord {
  x: number;
  y: number;
}

// What the crosshair overlay needs to draw itself: a vertical guide line
// spanning the plot area at the hovered point's x, and a small floating box
// of text lines positioned near that point (see HistoryComponent.tooltipBox
// for how box.x/y are chosen to stay inside the chart and clear of the
// point itself).
interface ChartTooltipLine {
  text: string;
  // Matches the line/dot color it reports on (e.g. the weight line's own
  // blue) so it's unambiguous which number belongs to which series even
  // though both dots highlight identically on hover - omitted for lines
  // (the date, the rep count) that aren't tied to a colored series.
  color?: string;
}

interface ChartTooltip {
  crosshairX: number;
  crosshairTop: number;
  crosshairBottom: number;
  box: { x: number; y: number; width: number; height: number };
  lines: ChartTooltipLine[];
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    DatePipe,
    NgTemplateOutlet,
    TranslatePipe,
    SelectOnFocusDirective
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
  // Plain component-local filter state (not persisted) - narrows the
  // sessions shown in both the Sessions tab and the Charts tab, since the
  // latter's exercisesWithHistory/chartPoints are derived from
  // finishedSessions too (see below). dateFrom defaults to 90 days back
  // rather than an open lower bound, so a long history doesn't load every
  // session on first view.
  dateFrom = HistoryComponent.dateInputValue(90);
  dateTo = '';

  // Index into the currently hovered chart's own points array (null when
  // the pointer is outside it) - drives the crosshair line and floating
  // tooltip in the template. Kept separate per chart since both can exist
  // on screen (this exercise's own chart and the body-weight chart below
  // it) and hovering one must never affect the other's crosshair.
  hoveredExerciseChartIndex: number | null = null;
  hoveredBodyWeightChartIndex: number | null = null;

  private static dateInputValue(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

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

  get language(): string {
    return this.settingsService.getSettings().language;
  }

  // True only once both fields hold a date and they're the wrong way round -
  // an empty field on either side means "no bound on that side", not an
  // error. While invalid, the date filter below is skipped entirely (shows
  // every finished session) rather than silently applying a half-broken
  // range.
  get dateRangeInvalid(): boolean {
    if (!this.dateFrom || !this.dateTo) {
      return false;
    }
    return new Date(this.dateTo).getTime() < new Date(this.dateFrom).getTime();
  }

  // Sorted strictly by the session's own date/time - session.sequence is a
  // Sessions-page-only concept (lets manually added sessions float to the
  // top of the pending list ahead of plan-queued ones) and doesn't reflect
  // when a finished session actually happened, so it's not used here.
  //
  // Also the single source both history tabs filter through: the Charts
  // tab's exercisesWithHistory/chartPoints are derived from this same
  // getter, so narrowing it here narrows both tabs at once.
  get finishedSessions(): TrainingSession[] {
    const sorted = this.sessions
      .filter((session) => session.finished)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (this.dateRangeInvalid) {
      return sorted;
    }
    const fromTime = this.dateFrom ? new Date(this.dateFrom).getTime() : null;
    const toTime = this.dateTo ? this.endOfDayTime(this.dateTo) : null;
    return sorted.filter((session) => {
      const time = new Date(session.date).getTime();
      if (fromTime !== null && time < fromTime) {
        return false;
      }
      if (toTime !== null && time > toTime) {
        return false;
      }
      return true;
    });
  }

  // The "to" field is a plain date (no time-of-day), so a session logged
  // later that same day must still count as within range - compare against
  // the end of that day rather than its midnight start.
  private endOfDayTime(dateText: string): number {
    const date = new Date(dateText);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
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

  // Mirrors SessionsComponent.sessionExerciseTypeDisplay - a Time-Based
  // exercise's sets carry a duration in `seconds`, not `reps`/`weight`,
  // which were otherwise being shown here regardless of exercise type.
  isTimeBasedExercise(sessionExercise: SessionExercise): boolean {
    return sessionExercise.exerciseType === 'TIME_BASED';
  }

  private exerciseWeightLifted(sessionExercise: SessionExercise): number {
    const exercise = this.exercises.find((candidate) => candidate.id === sessionExercise.exerciseId);
    return this.countedSets(sessionExercise)
      .filter((set) => set.done)
      .reduce((sum, set) => sum + set.reps * (exercise ? liftedWeight(exercise, set.weight, set.doubleWeightCounting) : set.weight), 0);
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
    const allMet = sets.every((set) => this.setMetTarget(set));
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
    if (set.targetSeconds !== undefined) {
      return (set.seconds ?? 0) >= set.targetSeconds;
    }
    return set.targetReps === undefined || set.reps >= set.targetReps;
  }

  // Mirrors SessionsComponent.targetSecondsHint.
  targetSecondsHint(set: ExerciseSet): string | null {
    return set.targetSeconds !== undefined ? String(set.targetSeconds) : null;
  }

  // Lets a finished session's own logged numbers be corrected after the
  // fact (e.g. a typo caught later) - a pure historical-record edit, since
  // it only rewrites this one set's field and never touches anything
  // already derived from it (the exercise's oneRepMax, a later session's
  // starting weight, deload streaks, ...), all of which were computed once
  // at completion time from whatever was logged then and are left alone.
  historySetRepsDisplay(set: ExerciseSet): string {
    return String(set.reps);
  }

  onHistoryRepsFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 5);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateHistorySetReps(session: TrainingSession, set: ExerciseSet, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    set.reps = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 10000) : 0;
    await this.sessionsService.update(session);
  }

  historySetWeightDisplay(set: ExerciseSet): string {
    return set.weight.toFixed(2);
  }

  onHistoryWeightFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateHistorySetWeight(session: TrainingSession, set: ExerciseSet, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    set.weight = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 9999) : 0;
    await this.sessionsService.update(session);
  }

  historySetSecondsDisplay(set: ExerciseSet): string {
    return String(set.seconds ?? 0);
  }

  // Same 5-digit sanitization as SessionsComponent.onSecondsFieldInput.
  onHistorySecondsFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,5}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateHistorySetSeconds(session: TrainingSession, set: ExerciseSet, value: string): Promise<void> {
    const parsed = parseInt(value, 10);
    set.seconds = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 99999) : 0;
    await this.sessionsService.update(session);
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

  // The completed sets the charts are built from: only those of a type whose
  // "count warm-up/working/cooldown sets" setting is on for this session
  // exercise (see isSetCounted). All three off leaves nothing, so that
  // exercise drops out of the charts entirely.
  private chartSets(sessionExercise: SessionExercise): ExerciseSet[] {
    return sessionExercise.sets.filter((set) => set.done && isSetCounted(sessionExercise, set));
  }

  // Only exercises with at least one chartable set (see chartSets) in some
  // finished session show up in the chart picker - every other exercise has
  // nothing to plot.
  get exercisesWithHistory(): Exercise[] {
    const idsWithHistory = new Set(
      this.finishedSessions.flatMap((session) =>
        session.exercises.filter((sessionExercise) => this.chartSets(sessionExercise).length > 0).map((sessionExercise) => sessionExercise.exerciseId)
      )
    );
    return this.exercises.filter((exercise) => idsWithHistory.has(exercise.id));
  }

  get selectedChartPoints(): ExerciseChartPoint[] {
    return this.selectedChartExerciseId ? this.chartPoints(this.selectedChartExerciseId) : [];
  }

  // Oldest first, one point per finished session that logged this exercise -
  // the point is the chartable set (see chartSets) with the best estimated 1RM
  // that session, so the weight/1RM lines both trace the same set rather than
  // mismatched "heaviest weight this session" vs "best estimate this session"
  // sets.
  private chartPoints(exerciseId: string): ExerciseChartPoint[] {
    const exercise = this.exercises.find((candidate) => candidate.id === exerciseId);
    return [...this.finishedSessions]
      .reverse()
      .map((session): ExerciseChartPoint | null => {
        const sessionExercise = session.exercises.find((exercise) => exercise.exerciseId === exerciseId);
        const countedDoneSets = sessionExercise ? this.chartSets(sessionExercise) : [];
        if (countedDoneSets.length === 0) {
          return null;
        }
        const bestSet = countedDoneSets.reduce((best, set) =>
          estimateOneRepMax(liftedWeight(exercise ?? {}, set.weight, set.doubleWeightCounting), set.reps) >
          estimateOneRepMax(liftedWeight(exercise ?? {}, best.weight, best.doubleWeightCounting), best.reps)
            ? set
            : best
        );
        const liftedWeights = countedDoneSets.map((set) => liftedWeight(exercise ?? {}, set.weight, set.doubleWeightCounting));
        return {
          date: new Date(session.date),
          weight: liftedWeight(exercise ?? {}, bestSet.weight, bestSet.doubleWeightCounting),
          oneRepMax: estimateOneRepMax(liftedWeight(exercise ?? {}, bestSet.weight, bestSet.doubleWeightCounting), bestSet.reps),
          reps: bestSet.reps,
          allReps: countedDoneSets.map((set) => set.reps),
          averageWeight: liftedWeights.reduce((sum, weight) => sum + weight, 0) / liftedWeights.length
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

  // Finds which point's x is closest to the pointer, in the chart's own SVG
  // viewBox units rather than screen pixels - the chart scales to fit its
  // container (preserveAspectRatio), so a raw clientX only lines up with the
  // 600x260 viewBox coordinates chartCoords works in once rescaled by the
  // element's actual on-screen width.
  private nearestChartIndex(event: MouseEvent, coords: ChartCoord[]): number | null {
    if (coords.length === 0) {
      return null;
    }
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) {
      return null;
    }
    const x = ((event.clientX - rect.left) / rect.width) * this.chartWidth;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    coords.forEach((coord, index) => {
      const distance = Math.abs(coord.x - x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  onExerciseChartMove(event: MouseEvent): void {
    this.hoveredExerciseChartIndex = this.nearestChartIndex(event, this.chartCoords(this.selectedChartPoints, 'weight'));
  }

  onExerciseChartLeave(): void {
    this.hoveredExerciseChartIndex = null;
  }

  // Positions a tooltip box near (but not on top of) the hovered point,
  // flipping to the point's left once it would otherwise run past the
  // chart's right edge, and clamping vertically so it never spills above or
  // below the plot area regardless of where the point itself sits.
  // Width grows with the longest line (a multi-set exercise's "Wdh.: 8, 8, 6"
  // list has no fixed length) rather than staying at a fixed guess that
  // would either clip a long rep list or look oversized for a short one.
  // The x position is then clamped back inside the plot area in case that
  // grown width would otherwise push a tooltip near the chart's edge past
  // it in either direction.
  private tooltipBox(coord: ChartCoord, lines: ChartTooltipLine[]): { x: number; y: number; width: number; height: number } {
    const longestLine = Math.max(...lines.map((line) => line.text.length), 0);
    const width = Math.max(150, longestLine * 6 + 16);
    const height = lines.length * 16 + 12;
    const wouldOverflowRight = coord.x + 10 + width > this.chartWidth - this.chartPadding.right;
    const rawX = wouldOverflowRight ? coord.x - 10 - width : coord.x + 10;
    const x = Math.min(Math.max(rawX, this.chartPadding.left), this.chartWidth - this.chartPadding.right - width);
    const minY = this.chartPadding.top;
    const maxY = this.chartHeight - this.chartPadding.bottom - height;
    const y = Math.min(Math.max(coord.y - height / 2, minY), maxY);
    return { x, y, width, height };
  }

  get exerciseChartTooltip(): ChartTooltip | null {
    if (this.hoveredExerciseChartIndex === null) {
      return null;
    }
    const point = this.selectedChartPoints[this.hoveredExerciseChartIndex];
    const coord = this.chartCoords(this.selectedChartPoints, 'weight')[this.hoveredExerciseChartIndex];
    if (!point || !coord) {
      return null;
    }
    const dateText = this.datePipe.transform(point.date, this.settingsService.getSettings().dateFormat) ?? '';
    const repsLabel = this.translationService.translate('sessions.reps');
    const oneRepMaxLabel = this.translationService.translate('history.chartOneRepMaxLegend');
    // More than one working set that session -> list every set's own reps
    // rather than just the single best set's, and label the weight as an
    // explicit average (never silently averaging a single set into looking
    // like more than it is - see ExerciseChartPoint's own comment).
    const hasMultipleSets = point.allReps.length > 1;
    const repsText = hasMultipleSets ? point.allReps.join(', ') : String(point.reps);
    const weightLabel = this.translationService.translate(hasMultipleSets ? 'history.chartAverageWeightLegend' : 'history.chartWeightLegend');
    const weightValue = hasMultipleSets ? point.averageWeight : point.weight;
    // Colors match .chart-line-weight/.chart-dot-weight and .chart-line-1rm/
    // .chart-dot-1rm exactly, so the tooltip's own text ties each number
    // back to its line/dot without the reader having to cross-reference the
    // legend above the chart.
    const lines: ChartTooltipLine[] = [
      { text: dateText },
      { text: `${repsLabel}: ${repsText}` },
      { text: `${weightLabel}: ${weightValue.toFixed(2)} ${this.weightUnitLabel}`, color: '#64b5f6' },
      { text: `${oneRepMaxLabel}: ${point.oneRepMax.toFixed(2)} ${this.weightUnitLabel}`, color: '#ffca28' }
    ];
    return {
      crosshairX: coord.x,
      crosshairTop: this.chartPadding.top,
      crosshairBottom: this.chartHeight - this.chartPadding.bottom,
      box: this.tooltipBox(coord, lines),
      lines
    };
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

  onBodyWeightChartMove(event: MouseEvent): void {
    this.hoveredBodyWeightChartIndex = this.nearestChartIndex(event, this.bodyWeightChartCoords(this.bodyWeightChartPoints));
  }

  onBodyWeightChartLeave(): void {
    this.hoveredBodyWeightChartIndex = null;
  }

  get bodyWeightChartTooltip(): ChartTooltip | null {
    if (this.hoveredBodyWeightChartIndex === null) {
      return null;
    }
    const point = this.bodyWeightChartPoints[this.hoveredBodyWeightChartIndex];
    const coord = this.bodyWeightChartCoords(this.bodyWeightChartPoints)[this.hoveredBodyWeightChartIndex];
    if (!point || !coord) {
      return null;
    }
    const dateText = this.datePipe.transform(point.date, this.settingsService.getSettings().dateFormat) ?? '';
    const weightLabel = this.translationService.translate('history.chartWeightLegend');
    // Matches .chart-line-bodyweight/.chart-dot-bodyweight.
    const lines: ChartTooltipLine[] = [
      { text: dateText },
      { text: `${weightLabel}: ${point.weight.toFixed(2)} ${this.weightUnitLabel}`, color: '#66bb6a' }
    ];
    return {
      crosshairX: coord.x,
      crosshairTop: this.chartPadding.top,
      crosshairBottom: this.chartHeight - this.chartPadding.bottom,
      box: this.tooltipBox(coord, lines),
      lines
    };
  }
}
