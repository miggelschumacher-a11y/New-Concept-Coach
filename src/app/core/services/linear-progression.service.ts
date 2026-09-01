import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { AsyncLock } from '../utils/async-lock.util';
import { computeNextLinearProgressionState, LinearProgressionResult } from '../utils/linear-progression.util';
import { LinearProgressionState } from '../models/linear-progression.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';

@Injectable({ providedIn: 'root' })
export class LinearProgressionService {
  private readonly lock = new AsyncLock();

  constructor(private readonly db: IndexedDbService) {}

  async getState(exerciseId: string): Promise<LinearProgressionState | null> {
    const stored = await this.db.get<LinearProgressionState>(STORES.linearProgression, exerciseId);
    return stored ?? null;
  }

  async initState(exerciseId: string, startWeight: number): Promise<LinearProgressionState> {
    return this.lock.acquire(async () => {
      const existing = await this.db.get<LinearProgressionState>(STORES.linearProgression, exerciseId);
      if (existing) {
        return existing;
      }
      const state: LinearProgressionState = {
        id: exerciseId,
        exerciseId,
        currentWeight: startWeight,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.linearProgression, state);
      return state;
    });
  }

  async recordSessionResult(
    exerciseId: string,
    success: boolean,
    result: LinearProgressionResult,
    exerciseCategory: ExerciseWeightCategory,
    incrementOverride?: number
  ): Promise<LinearProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<LinearProgressionState>(STORES.linearProgression, exerciseId);
      if (!current) {
        throw new Error(`LinearProgressionService: no state initialized for exercise ${exerciseId}.`);
      }
      const next = computeNextLinearProgressionState(current, success, result, exerciseCategory, incrementOverride);
      await this.db.put(STORES.linearProgression, next);
      return next;
    });
  }

  async resetState(exerciseId: string, startWeight: number): Promise<LinearProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<LinearProgressionState>(STORES.linearProgression, exerciseId);
      if (!current) {
        throw new Error(`LinearProgressionService: no state to reset for exercise ${exerciseId}.`);
      }
      const reset: LinearProgressionState = { ...current, currentWeight: startWeight, lastUpdated: new Date() };
      await this.db.put(STORES.linearProgression, reset);
      return reset;
    });
  }

  async deleteState(exerciseId: string): Promise<void> {
    await this.lock.acquire(async () => {
      await this.db.delete(STORES.linearProgression, exerciseId);
    });
  }
}
