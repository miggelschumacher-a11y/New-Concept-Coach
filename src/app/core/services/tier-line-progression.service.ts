import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { AsyncLock } from '../utils/async-lock.util';
import { computeNextTierLineState, SessionResult } from '../utils/tier-line-progression.util';
import { TierLineProgressionState, GzclTier, TierLineStage } from '../models/tier-line-progression.model';

@Injectable({ providedIn: 'root' })
export class TierLineProgressionService {
  private readonly lock = new AsyncLock();

  constructor(private readonly db: IndexedDbService) {}

  /** Liest den aktuellen Fortschrittsstatus einer Übung, oder null falls noch nicht initialisiert. */
  async getState(exerciseId: string): Promise<TierLineProgressionState | null> {
    const stored = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, exerciseId);
    return stored ?? null;
  }

  /** Initialisiert den Progression-State für eine Übung (z.B. bei erster Zuweisung als T1/T2/T3). */
  async initState(
    exerciseId: string,
    tier: GzclTier,
    startWeight: number,
    stage: TierLineStage = TierLineStage.STAGE_1
  ): Promise<TierLineProgressionState> {
    return this.lock.acquire(async () => {
      const existing = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, exerciseId);
      if (existing) {
        // Bereits initialisiert -> nicht überschreiben, außer explizit gewünscht
        return existing;
      }
      const state: TierLineProgressionState = {
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
   * den daraus resultierenden neuen State. AsyncLock schützt gegen Race Conditions,
   * falls z.B. Sync gleichzeitig denselben Key schreibt.
   */
  async recordSessionResult(
    exerciseId: string,
    result: SessionResult
  ): Promise<TierLineProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, exerciseId);
      if (!current) {
        throw new Error(
          `TierLineProgressionService: Kein State für Exercise ${exerciseId} initialisiert.`
        );
      }
      const next = computeNextTierLineState(current, result);
      await this.db.put(STORES.tierLineProgression, next);
      return next;
    });
  }

  /** Setzt den Fortschritt einer Übung manuell zurück (z.B. nach Verletzungspause). */
  async resetState(
    exerciseId: string,
    startWeight: number
  ): Promise<TierLineProgressionState> {
    return this.lock.acquire(async () => {
      const current = await this.db.get<TierLineProgressionState>(STORES.tierLineProgression, exerciseId);
      if (!current) {
        throw new Error(
          `TierLineProgressionService: Kein State für Exercise ${exerciseId} zum Zurücksetzen vorhanden.`
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
  async deleteState(exerciseId: string): Promise<void> {
    await this.lock.acquire(async () => {
      await this.db.delete(STORES.tierLineProgression, exerciseId);
    });
  }
}
