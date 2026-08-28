import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { ExercisesService } from './exercises.service';
import { TrainingPlan } from '../models/training-plan.model';
import { DEFAULT_531_PLAN_ID, buildDefault531Plan } from '../data/default-531-plan';

@Injectable({ providedIn: 'root' })
export class TrainingPlansService {
  constructor(
    private readonly db: IndexedDbService,
    private readonly exercisesService: ExercisesService
  ) {}

  async getAll(): Promise<TrainingPlan[]> {
    await this.ensureDefaultPlan();
    return this.db.getAll<TrainingPlan>(STORES.trainingPlans);
  }

  // A DB restore/import (Drive or local file) replaces the whole trainingPlans
  // store with whatever the backup contains, which can silently drop the
  // default plan if it predates it. Re-checking on every load makes the
  // default plan self-healing instead of a one-time migration that a restore
  // can permanently undo.
  private async ensureDefaultPlan(): Promise<void> {
    const existing = await this.db.get<TrainingPlan>(STORES.trainingPlans, DEFAULT_531_PLAN_ID);
    if (existing) {
      return;
    }
    const exercises = await this.exercisesService.getAll();
    const exerciseIdByName = new Map(exercises.map((exercise) => [exercise.name, exercise.id]));
    const defaultPlan = buildDefault531Plan(exerciseIdByName);
    if (defaultPlan) {
      await this.db.put(STORES.trainingPlans, defaultPlan);
    }
  }

  add(plan: Omit<TrainingPlan, 'id'>): Promise<TrainingPlan> {
    const newPlan: TrainingPlan = { ...plan, id: crypto.randomUUID() };
    return this.db.add(STORES.trainingPlans, newPlan).then(() => newPlan);
  }

  update(plan: TrainingPlan): Promise<void> {
    return this.db.put(STORES.trainingPlans, plan);
  }

  delete(id: string): Promise<void> {
    return this.db.delete(STORES.trainingPlans, id);
  }
}
