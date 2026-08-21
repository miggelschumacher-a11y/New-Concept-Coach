import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { TrainingPlan } from '../models/training-plan.model';

@Injectable({ providedIn: 'root' })
export class TrainingPlansService {
  constructor(private readonly db: IndexedDbService) {}

  getAll(): Promise<TrainingPlan[]> {
    return this.db.getAll<TrainingPlan>(STORES.trainingPlans);
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
