import { Routes } from '@angular/router';
import { ConfigComponent } from './config/config.component';
import { ExercisesComponent } from './exercises/exercises.component';
import { SessionsComponent } from './sessions/sessions.component';
import { TrainingPlansComponent } from './training-plans/training-plans.component';

export const routes: Routes = [
  { path: '', redirectTo: 'training-plans', pathMatch: 'full' },
  { path: 'training-plans', component: TrainingPlansComponent },
  { path: 'exercises', component: ExercisesComponent },
  { path: 'sessions', component: SessionsComponent },
  { path: 'config', component: ConfigComponent }
];
