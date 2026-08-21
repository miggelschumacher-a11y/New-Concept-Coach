import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { TrainingSession, SessionExercise, SetType, ExerciseSet } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const SET_TYPES: { value: SetType; label: string }[] = [
  { value: 'warmup', label: 'Aufwärm-Sätze' },
  { value: 'working', label: 'Arbeitssätze' },
  { value: 'cooldown', label: 'Cooldown-Sätze' }
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
    DatePipe
  ],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss'
})
export class SessionsComponent implements OnInit {
  readonly setTypes = SET_TYPES;
  sessions: TrainingSession[] = [];
  exercises: Exercise[] = [];
  date = toDateTimeLocalValue(new Date());
  private readonly selectedExerciseIdsCache = new Map<string, string[]>();

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService
  ) {}

  get dateFormat(): string {
    return `${this.settingsService.getSettings().dateFormat}, HH:mm`;
  }

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadExercises()]);
  }

  async load(): Promise<void> {
    this.sessions = await this.sessionsService.getAll();
  }

  async loadExercises(): Promise<void> {
    this.exercises = await this.exercisesService.getAll();
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

  async addSession(): Promise<void> {
    if (!this.date) {
      return;
    }
    await this.sessionsService.add({ date: this.date, exercises: [] });
    await this.load();
  }

  async updateSessionExercises(session: TrainingSession, exerciseIds: string[]): Promise<void> {
    const existingByExerciseId = new Map(
      session.exercises.map((sessionExercise) => [sessionExercise.exerciseId, sessionExercise])
    );
    session.exercises = exerciseIds.map(
      (exerciseId) => existingByExerciseId.get(exerciseId) ?? { exerciseId, sets: [] }
    );
    await this.sessionsService.update(session);
  }

  async removeExerciseFromSession(session: TrainingSession, exerciseId: string): Promise<void> {
    session.exercises = session.exercises.filter((sessionExercise) => sessionExercise.exerciseId !== exerciseId);
    await this.sessionsService.update(session);
  }

  setsByType(sessionExercise: SessionExercise, type: SetType): ExerciseSet[] {
    return sessionExercise.sets.filter((set) => set.type === type);
  }

  async addSet(session: TrainingSession, sessionExercise: SessionExercise, type: SetType): Promise<void> {
    sessionExercise.sets = [...sessionExercise.sets, { id: crypto.randomUUID(), reps: 0, weight: 0, type }];
    await this.sessionsService.update(session);
  }

  async removeSet(session: TrainingSession, sessionExercise: SessionExercise, setId: string): Promise<void> {
    sessionExercise.sets = sessionExercise.sets.filter((set) => set.id !== setId);
    await this.sessionsService.update(session);
  }

  async onRepsChange(session: TrainingSession, set: ExerciseSet): Promise<void> {
    set.reps = Math.min(Math.max(set.reps, 0), 10000);
    await this.sessionsService.update(session);
  }

  onWeightInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d*[.,]?\d{0,2}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async onWeightChange(session: TrainingSession, set: ExerciseSet, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    set.weight = Number.isFinite(parsed) ? Math.round(Math.max(parsed, 0) * 100) / 100 : 0;
    await this.sessionsService.update(session);
  }

  async updateSessionNotes(session: TrainingSession): Promise<void> {
    await this.sessionsService.update(session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionsService.delete(id);
    await this.load();
  }
}
