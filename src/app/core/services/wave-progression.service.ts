import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { AsyncLock } from '../utils/async-lock.util';
import { computeNextWaveProgressionState, WaveProgressionResult } from '../utils/wave-progression.util';
import { WaveProgressionState } from '../models/wave-progression.model';
import { WaveProgressionConfig } from '../models/training-plan.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';

@Injectable({ providedIn: 'root' })
export class WaveProgressionService {
  private readonly lock = new AsyncLock();

  constructor(private readonly db: IndexedDbService) {}

  async getState(exerciseId: string): Promise<WaveProgressionState | null> {
    const stored = await this.db.get<WaveProgressionState>(STORES.waveProgression, exerciseId);
    return stored ?? null;
  }

  async initState(exerciseId: string, startReps: number, startWeight: number): Promise<WaveProgressionState> {
    return this.lock.acquire(async () => {
      const existing = await this.db.get<WaveProgressionState>(STORES.waveProgression, exerciseId);
      if (existing) {
        return existing;
      }
      const state: WaveProgressionState = {
        id: exerciseId,
        exerciseId,
        currentReps: startReps,
        currentWeight: startWeight,
        waveStartWeight: startWeight,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.waveProgression, state);
      return state;
    });
  }

  async recordSessionResult(
    exerciseId: string,
    config: WaveProgressionConfig,
    result: WaveProgressionResult,
    exerciseCategory: ExerciseWeightCategory,
    incrementOverride?: number
  ): Promise<WaveProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<WaveProgressionState>(STORES.waveProgression, exerciseId);
      if (!current) {
        throw new Error(`WaveProgressionService: no state initialized for exercise ${exerciseId}.`);
      }
      const next = computeNextWaveProgressionState(current, config, result, exerciseCategory, incrementOverride);
      await this.db.put(STORES.waveProgression, next);
      return next;
    });
  }

  async resetState(exerciseId: string, startReps: number, startWeight: number): Promise<WaveProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<WaveProgressionState>(STORES.waveProgression, exerciseId);
      if (!current) {
        throw new Error(`WaveProgressionService: no state to reset for exercise ${exerciseId}.`);
      }
      const reset: WaveProgressionState = {
        ...current,
        currentReps: startReps,
        currentWeight: startWeight,
        waveStartWeight: startWeight,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.waveProgression, reset);
      return reset;
    });
  }

  async deleteState(exerciseId: string): Promise<void> {
    await this.lock.acquire(async () => {
      await this.db.delete(STORES.waveProgression, exerciseId);
    });
  }
}
