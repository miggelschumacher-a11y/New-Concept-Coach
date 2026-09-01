import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { AsyncLock } from '../utils/async-lock.util';
import { computeNextDoubleProgressionState, DoubleProgressionResult } from '../utils/double-progression.util';
import { DoubleProgressionState } from '../models/double-progression.model';
import { DoubleProgressionConfig } from '../models/training-plan.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';

@Injectable({ providedIn: 'root' })
export class DoubleProgressionService {
  private readonly lock = new AsyncLock();

  constructor(private readonly db: IndexedDbService) {}

  async getState(exerciseId: string): Promise<DoubleProgressionState | null> {
    const stored = await this.db.get<DoubleProgressionState>(STORES.doubleProgression, exerciseId);
    return stored ?? null;
  }

  async initState(exerciseId: string, startWeight: number): Promise<DoubleProgressionState> {
    return this.lock.acquire(async () => {
      const existing = await this.db.get<DoubleProgressionState>(STORES.doubleProgression, exerciseId);
      if (existing) {
        return existing;
      }
      const state: DoubleProgressionState = {
        id: exerciseId,
        exerciseId,
        currentWeight: startWeight,
        repsAddedThisCycle: 0,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.doubleProgression, state);
      return state;
    });
  }

  async recordSessionResult(
    exerciseId: string,
    config: DoubleProgressionConfig,
    result: DoubleProgressionResult,
    exerciseCategory: ExerciseWeightCategory,
    incrementOverride?: number
  ): Promise<DoubleProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<DoubleProgressionState>(STORES.doubleProgression, exerciseId);
      if (!current) {
        throw new Error(`DoubleProgressionService: no state initialized for exercise ${exerciseId}.`);
      }
      const next = computeNextDoubleProgressionState(current, config, result, exerciseCategory, incrementOverride);
      await this.db.put(STORES.doubleProgression, next);
      return next;
    });
  }

  async resetState(exerciseId: string, startWeight: number): Promise<DoubleProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<DoubleProgressionState>(STORES.doubleProgression, exerciseId);
      if (!current) {
        throw new Error(`DoubleProgressionService: no state to reset for exercise ${exerciseId}.`);
      }
      const reset: DoubleProgressionState = {
        ...current,
        currentWeight: startWeight,
        repsAddedThisCycle: 0,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.doubleProgression, reset);
      return reset;
    });
  }

  async deleteState(exerciseId: string): Promise<void> {
    await this.lock.acquire(async () => {
      await this.db.delete(STORES.doubleProgression, exerciseId);
    });
  }
}
