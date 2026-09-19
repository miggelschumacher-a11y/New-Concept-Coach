import { Routes } from '@angular/router';
import { ConfigComponent } from './config/config.component';
import { ExercisesComponent } from './exercises/exercises.component';
import { ExerciseHistoryComponent } from './exercises/exercise-history/exercise-history.component';
import { HistoryComponent } from './history/history.component';
import { SessionsComponent } from './sessions/sessions.component';
import { TrainingPlansComponent } from './training-plans/training-plans.component';

export const routes: Routes = [
  { path: '', redirectTo: 'sessions', pathMatch: 'full' },
  { path: 'training-plans', component: TrainingPlansComponent },
  { path: 'exercises', component: ExercisesComponent },
  { path: 'exercise-history/:id', component: ExerciseHistoryComponent },
  { path: 'sessions', component: SessionsComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'config', component: ConfigComponent }
];
