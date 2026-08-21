import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { SessionsService } from '../core/services/sessions.service';
import { ExercisesService } from '../core/services/exercises.service';
import { TrainingSession } from '../core/models/session.model';
import { Exercise } from '../core/models/exercise.model';

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
    MatChipsModule
  ],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss'
})
export class SessionsComponent implements OnInit {
  sessions: TrainingSession[] = [];
  exercises: Exercise[] = [];
  date = new Date().toISOString().slice(0, 10);
  notes = '';

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
    await this.sessionsService.add({ date: this.date, notes: this.notes.trim(), exerciseIds: [] });
    this.notes = '';
    await this.load();
  }

  async updateSessionExercises(session: TrainingSession, exerciseIds: string[]): Promise<void> {
    session.exerciseIds = exerciseIds;
    await this.sessionsService.update(session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionsService.delete(id);
    await this.load();
  }
}
