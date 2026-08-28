import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { AsyncLock } from '../utils/async-lock.util';
import { computeNextRepGoalState, RepGoalResult } from '../utils/rep-goal.util';
import { RepGoalState } from '../models/rep-goal.model';
import { RepGoalConfig } from '../models/training-plan.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';

@Injectable({ providedIn: 'root' })
export class RepGoalService {
  private readonly lock = new AsyncLock();

  constructor(private readonly db: IndexedDbService) {}

  async getState(exerciseId: string): Promise<RepGoalState | null> {
    const stored = await this.db.get<RepGoalState>(STORES.repGoalProgression, exerciseId);
    return stored ?? null;
  }

  async initState(exerciseId: string, startWeight: number): Promise<RepGoalState> {
    return this.lock.acquire(async () => {
      const existing = await this.db.get<RepGoalState>(STORES.repGoalProgression, exerciseId);
      if (existing) {
        return existing;
      }
      const state: RepGoalState = {
        id: exerciseId,
        exerciseId,
        currentWeight: startWeight,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.repGoalProgression, state);
      return state;
    });
  }

  async recordSessionResult(
    exerciseId: string,
    config: RepGoalConfig,
    result: RepGoalResult,
    exerciseCategory: ExerciseWeightCategory
  ): Promise<RepGoalState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<RepGoalState>(STORES.repGoalProgression, exerciseId);
      if (!current) {
        throw new Error(`RepGoalService: no state initialized for exercise ${exerciseId}.`);
      }
      const next = computeNextRepGoalState(current, config, result, exerciseCategory);
      await this.db.put(STORES.repGoalProgression, next);
      return next;
    });
  }

  async resetState(exerciseId: string, startWeight: number): Promise<RepGoalState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<RepGoalState>(STORES.repGoalProgression, exerciseId);
      if (!current) {
        throw new Error(`RepGoalService: no state to reset for exercise ${exerciseId}.`);
      }
      const reset: RepGoalState = { ...current, currentWeight: startWeight, lastUpdated: new Date() };
      await this.db.put(STORES.repGoalProgression, reset);
      return reset;
    });
  }

  async deleteState(exerciseId: string): Promise<void> {
    await this.lock.acquire(async () => {
      await this.db.delete(STORES.repGoalProgression, exerciseId);
    });
  }
}
