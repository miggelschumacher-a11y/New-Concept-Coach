import { Component, OnInit } from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExercisesService } from '../../core/services/exercises.service';
import { SessionsService } from '../../core/services/sessions.service';
import { SettingsService } from '../../core/services/settings.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { buildExerciseHistory, ExerciseHistoryEntry } from '../../core/utils/exercise-history.util';

// One exercise's history across every session it was done in, newest first -
// opened from the info button in that exercise's accordion header on the
// Exercises, Sessions and Training Plans pages (route: exercise-history/:id).
@Component({
  selector: 'app-exercise-history',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './exercise-history.component.html',
  styleUrl: './exercise-history.component.scss'
})
export class ExerciseHistoryComponent implements OnInit {
  exerciseName = '';
  entries: ExerciseHistoryEntry[] = [];
  loaded = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly location: Location,
    private readonly exercisesService: ExercisesService,
    private readonly sessionsService: SessionsService,
    private readonly settingsService: SettingsService
  ) {}

  get dateFormat(): string {
    return `${this.settingsService.getSettings().dateFormat}, HH:mm`;
  }

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    const exerciseId = this.route.snapshot.paramMap.get('id') ?? '';
    const [exercises, sessions] = await Promise.all([this.exercisesService.getAll(), this.sessionsService.getAll()]);
    const exercise = exercises.find((candidate) => candidate.id === exerciseId);
    this.exerciseName = exercise?.name ?? '';
    this.entries = buildExerciseHistory(exerciseId, exercise, sessions);
    this.loaded = true;
  }

  back(): void {
    this.location.back();
  }
}
