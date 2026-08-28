import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { ExercisesService } from './exercises.service';
import { TrainingPlan } from '../models/training-plan.model';
import { DEFAULT_531_PLAN_ID, buildDefault531Plan } from '../data/default-531-plan';
import { DEFAULT_5X5_PLAN_ID, buildDefault5x5Plan } from '../data/default-5x5-plan';
import { DEFAULT_GZCLP_PLAN_ID, buildDefaultGzclpPlan } from '../data/default-gzclp-plan';
import { DEFAULT_GREYSKULL_PLAN_ID, buildDefaultGreyskullPlan } from '../data/default-greyskull-plan';
import { DEFAULT_NSUNS_PLAN_ID, buildDefaultNsunsPlan } from '../data/default-nsuns-plan';
import { DEFAULT_HEAVYDUTY_PLAN_ID, buildDefaultHeavyDutyPlan } from '../data/default-heavyduty-plan';

const DEFAULT_PLANS = [
  { id: DEFAULT_531_PLAN_ID, build: buildDefault531Plan },
  { id: DEFAULT_5X5_PLAN_ID, build: buildDefault5x5Plan },
  { id: DEFAULT_GZCLP_PLAN_ID, build: buildDefaultGzclpPlan },
  { id: DEFAULT_GREYSKULL_PLAN_ID, build: buildDefaultGreyskullPlan },
  { id: DEFAULT_NSUNS_PLAN_ID, build: buildDefaultNsunsPlan },
  { id: DEFAULT_HEAVYDUTY_PLAN_ID, build: buildDefaultHeavyDutyPlan }
];

@Injectable({ providedIn: 'root' })
export class TrainingPlansService {
  constructor(
    private readonly db: IndexedDbService,
    private readonly exercisesService: ExercisesService
  ) {}

  async getAll(): Promise<TrainingPlan[]> {
    await this.ensureDefaultPlans();
    return this.db.getAll<TrainingPlan>(STORES.trainingPlans);
  }

  // A DB restore/import (Drive or local file) replaces the whole trainingPlans
  // store with whatever the backup contains, which can silently drop a default
  // plan if it predates it. Re-checking on every load makes the default plans
  // self-healing instead of a one-time migration that a restore can
  // permanently undo.
  private async ensureDefaultPlans(): Promise<void> {
    const existingPlans = await this.db.getAll<TrainingPlan>(STORES.trainingPlans);
    const existingIds = new Set(existingPlans.map((plan) => plan.id));
    const missing = DEFAULT_PLANS.filter(({ id }) => !existingIds.has(id));
    if (missing.length === 0) {
      return;
    }
    const exercises = await this.exercisesService.getAll();
    const exerciseIdByName = new Map(exercises.map((exercise) => [exercise.name, exercise.id]));
    for (const { build } of missing) {
      const defaultPlan = build(exerciseIdByName);
      if (defaultPlan) {
        await this.db.put(STORES.trainingPlans, defaultPlan);
      }
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
