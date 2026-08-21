import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { TrainingSession } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
    MatListModule,
    DatePipe
  ],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss'
})
export class SessionsComponent implements OnInit {
  sessions: TrainingSession[] = [];
  exercises: Exercise[] = [];
  date = toDateTimeLocalValue(new Date());

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly exercisesService: ExercisesService
  ) {}

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

  async addSession(): Promise<void> {
    if (!this.date) {
      return;
    }
    await this.sessionsService.add({ date: this.date, exerciseIds: [] });
    await this.load();
  }

  async updateSessionExercises(session: TrainingSession, exerciseIds: string[]): Promise<void> {
    session.exerciseIds = exerciseIds;
    await this.sessionsService.update(session);
  }

  async removeExerciseFromSession(session: TrainingSession, exerciseId: string): Promise<void> {
    await this.updateSessionExercises(session, session.exerciseIds.filter((id) => id !== exerciseId));
  }

  async updateSessionNotes(session: TrainingSession): Promise<void> {
    await this.sessionsService.update(session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionsService.delete(id);
    await this.load();
  }
}
