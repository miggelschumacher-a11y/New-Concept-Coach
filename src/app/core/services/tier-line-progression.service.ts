import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { AsyncLock } from '../utils/async-lock.util';
import { computeNextTierLineState, SessionResult } from '../utils/tier-line-progression.util';
import {
  TierLineProgressionState,
  GzclTier,
  TierLineStage,
  ExerciseWeightCategory
} from '../models/tier-line-progression.model';

@Injectable({ providedIn: 'root' })
export class TierLineProgressionService {
  private readonly lock = new AsyncLock();

  constructor(private readonly db: IndexedDbService) {}

  private stateId(exerciseId: string, tier: GzclTier): string {
    return `${exerciseId}:${tier}`;
  }

  /** Liest den aktuellen Fortschrittsstatus einer Übung in einem Tier, oder null falls noch nicht initialisiert. */
  async getState(exerciseId: string, tier: GzclTier): Promise<TierLineProgressionState | null> {
    const stored = await this.db.get<TierLineProgressionState>(
      STORES.tierLineProgression,
      this.stateId(exerciseId, tier)
    );
    return stored ?? null;
  }

  /** Liest alle bisher initialisierten Fortschrittsstände (z.B. zur Anzeige in der UI). */
  async getAllStates(): Promise<TierLineProgressionState[]> {
    return this.db.getAll<TierLineProgressionState>(STORES.tierLineProgression);
  }

  /** Initialisiert den Progression-State für eine Übung in einem Tier (z.B. bei erster Zuweisung als T1/T2/T3). */
  async initState(
    exerciseId: string,
    tier: GzclTier,
    startWeight: number,
    stage: TierLineStage = TierLineStage.STAGE_1
  ): Promise<TierLineProgressionState> {
    return this.lock.acquire(async () => {
      const id = this.stateId(exerciseId, tier);
      const existing = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, id);
      if (existing) {
        // Bereits initialisiert -> nicht überschreiben, außer explizit gewünscht
        return existing;
      }
      const state: TierLineProgressionState = {
        id,
        exerciseId,
        tier,
        stage,
        currentWeight: startWeight,
        consecutiveFails: 0,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.tierLineProgression, state);
      return state;
    });
  }

  /**
   * Verarbeitet das Ergebnis einer abgeschlossenen Session-Übung und persistiert
   * den daraus resultierenden neuen State. exerciseCategory steuert die
   * Gewichtssteigerung (Unter- vs. Oberkörper). AsyncLock schützt gegen Race
   * Conditions, falls z.B. Sync gleichzeitig denselben Key schreibt.
   */
  async recordSessionResult(
    exerciseId: string,
    tier: GzclTier,
    result: SessionResult,
    exerciseCategory: ExerciseWeightCategory
  ): Promise<TierLineProgressionState> {
    return this.lock.acquire(async () => {
      const id = this.stateId(exerciseId, tier);
      const current = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, id);
      if (!current) {
        throw new Error(
          `TierLineProgressionService: Kein State für Exercise ${exerciseId} (${tier}) initialisiert.`
        );
      }
      const next = computeNextTierLineState(current, result, exerciseCategory);
      await this.db.put(STORES.tierLineProgression, next);
      return next;
    });
  }

  /** Setzt den Fortschritt einer Übung in einem Tier manuell zurück (z.B. nach Verletzungspause). */
  async resetState(exerciseId: string, tier: GzclTier, startWeight: number): Promise<TierLineProgressionState> {
    return this.lock.acquire(async () => {
      const id = this.stateId(exerciseId, tier);
      const current = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, id);
      if (!current) {
        throw new Error(
          `TierLineProgressionService: Kein State für Exercise ${exerciseId} (${tier}) zum Zurücksetzen vorhanden.`
        );
      }
      const reset: TierLineProgressionState = {
        ...current,
        stage: TierLineStage.STAGE_1,
        currentWeight: startWeight,
        consecutiveFails: 0,
        lastUpdated: new Date()
      };
      await this.db.put(STORES.tierLineProgression, reset);
      return reset;
    });
  }

  /** Entfernt den State komplett, z.B. wenn die Exercise gelöscht wird (ReferenceIntegrityService-Hook). */
  async deleteState(exerciseId: string, tier: GzclTier): Promise<void> {
    await this.lock.acquire(async () => {
      await this.db.delete(STORES.tierLineProgression, this.stateId(exerciseId, tier));
    });
  }
}
