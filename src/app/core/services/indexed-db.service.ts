import { Injectable } from '@angular/core';
import { Exercise } from '../models/exercise.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { buildDefault531Plan } from '../data/default-531-plan';
import { buildDefault5x5Plan } from '../data/default-5x5-plan';
import { buildDefaultGzclpPlan } from '../data/default-gzclp-plan';
import { buildDefaultGreyskullPlan } from '../data/default-greyskull-plan';
import { buildDefaultNsunsPlan } from '../data/default-nsuns-plan';
import { buildDefaultHeavyDutyPlan } from '../data/default-heavyduty-plan';

const DB_NAME = 'trainings-app-db';
const DB_VERSION = 21;

const DEFAULT_PLAN_BUILDERS = [
  buildDefault531Plan,
  buildDefault5x5Plan,
  buildDefaultGzclpPlan,
  buildDefaultGreyskullPlan,
  buildDefaultNsunsPlan,
  buildDefaultHeavyDutyPlan
];

export const STORES = {
  exercises: 'exercises',
  trainingPlans: 'trainingPlans',
  sessions: 'sessions',
  settings: 'settings',
  tierLineProgression: 'tierLineProgression',
  bodyWeightEntries: 'bodyWeightEntries'
} as const;

const STORE_KEY_PATHS: Partial<Record<string, string>> = {
  [STORES.tierLineProgression]: 'id'
};

const DEFAULT_EXERCISE_NAMES = [
  'Squat',
  'Deadlift',
  'Bench-Press',
  'Overhead-Press',
  'AB-Rollout',
  'AB-Wheel',
  'Back-Extension',
  'Barbell-Row',
  'Bent-Over-Dumbbell-Raise',
  'Cable-Push-Down',
  'Cable-Row',
  'Calf-Raises',
  'Chest-Supported-Rows',
  'Chin-Ups',
  'Lat-Pull-Downs',
  'Pull-Ups',
  'Dips',
  'Standing-Leg-Curls',
  'Neck-Extensions',
  'Neck-Curls',
  'Triceps-Push-Down'
];

// The TierLine Basis plan's T1/T2 lifts need a body region to pick the right
// weight increment (2.5 kg lower body / 1 kg upper body). Seeded here so
// it's correct out of the box instead of requiring manual setup per install.
const DEFAULT_EXERCISE_WEIGHT_CATEGORIES: Partial<Record<string, ExerciseWeightCategory>> = {
  Squat: 'LOWER_BODY',
  Deadlift: 'LOWER_BODY',
  'Bench-Press': 'UPPER_BODY',
  'Overhead-Press': 'UPPER_BODY'
};

export type StoreName = (typeof STORES)[keyof typeof STORES];

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const isNewDatabase = event.oldVersion === 0;

        // Recreate any store whose actual keyPath no longer matches
        // STORE_KEY_PATHS (e.g. tierLineProgression moved from exerciseId to
        // a composite `${exerciseId}:${tier}` id, since the same exercise can
        // rotate through different tier slots with independent progression).
        // Checking the real keyPath instead of the version number is what
        // actually matters here — relying on a version-range guard silently
        // failed to fire for databases that had already reached the target
        // version with the stale keyPath. No store affected by this had real
        // user data yet, so dropping and recreating loses nothing.
        for (const storeName of Object.values(STORES)) {
          const desiredKeyPath = STORE_KEY_PATHS[storeName] ?? 'id';
          if (
            db.objectStoreNames.contains(storeName) &&
            request.transaction!.objectStore(storeName).keyPath !== desiredKeyPath
          ) {
            db.deleteObjectStore(storeName);
          }
        }

        for (const storeName of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: STORE_KEY_PATHS[storeName] ?? 'id' });
          }
        }

        if (isNewDatabase) {
          const exercisesStore = request.transaction!.objectStore(STORES.exercises);
          const exerciseIdByName = new Map<string, string>();
          for (const name of DEFAULT_EXERCISE_NAMES) {
            const exercise: Exercise = {
              id: crypto.randomUUID(),
              name,
              category: '',
              weightCategory: DEFAULT_EXERCISE_WEIGHT_CATEGORIES[name]
            };
            exercisesStore.add(exercise);
            exerciseIdByName.set(name, exercise.id);
          }
          const trainingPlansStore = request.transaction!.objectStore(STORES.trainingPlans);
          for (const buildPlan of DEFAULT_PLAN_BUILDERS) {
            const defaultPlan = buildPlan(exerciseIdByName);
            if (defaultPlan) {
              trainingPlansStore.put(defaultPlan);
            }
          }
        } else {
          if (event.oldVersion < 8 && db.objectStoreNames.contains(STORES.exercises)) {
            // Backfill weightCategory on existing installs' Squat/Deadlift/Bench-Press/
            // Overhead-Press rows so TierLine progression picks the right increment
            // without the user having to set it manually first.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.openCursor().onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
              if (!cursor) {
                return;
              }
              const exercise = cursor.value as Exercise;
              const defaultCategory = DEFAULT_EXERCISE_WEIGHT_CATEGORIES[exercise.name];
              if (defaultCategory && !exercise.weightCategory) {
                cursor.update({ ...exercise, weightCategory: defaultCategory });
              }
              cursor.continue();
            };
          }

          if (
            event.oldVersion < 21 &&
            db.objectStoreNames.contains(STORES.exercises) &&
            db.objectStoreNames.contains(STORES.trainingPlans)
          ) {
            // Seed the default plans (5/3/1, 5x5, GZCLP, GreySkull LP, nSuns,
            // Heavy Duty) for
            // existing installs too, looking up the lift ids by name since
            // they're randomly generated per install. Re-running this is
            // harmless/idempotent (put), so it also re-adds any default plan
            // a restore/import may have dropped, and picks up content changes
            // (e.g. attribution added to a plan's name) that the self-healing
            // check alone wouldn't apply to an already-seeded plan.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.getAll().onsuccess = (getAllEvent) => {
              const allExercises = (getAllEvent.target as IDBRequest<Exercise[]>).result;
              const exerciseIdByName = new Map(allExercises.map((exercise) => [exercise.name, exercise.id]));
              const trainingPlansStore = request.transaction!.objectStore(STORES.trainingPlans);
              for (const buildPlan of DEFAULT_PLAN_BUILDERS) {
                const defaultPlan = buildPlan(exerciseIdByName);
                if (defaultPlan) {
                  trainingPlansStore.put(defaultPlan);
                }
              }
            };
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  private async runWriteTransaction(storeName: StoreName, work: (store: IDBObjectStore) => void): Promise<void> {
    const db = await this.dbPromise;
    const transaction = db.transaction(storeName, 'readwrite');
    work(transaction.objectStore(storeName));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return toPromise(store.getAll() as IDBRequest<T[]>);
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName, 'readonly');
    return toPromise(store.get(id) as IDBRequest<T | undefined>);
  }

  async add<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.add(item));
  }

  async put<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.put(item));
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.delete(id));
  }

  async exportAll(): Promise<Record<StoreName, unknown[]>> {
    const entries = await Promise.all(
      Object.values(STORES).map(async (storeName) => [storeName, await this.getAll(storeName)] as const)
    );
    return Object.fromEntries(entries) as Record<StoreName, unknown[]>;
  }

  async importAll(data: Partial<Record<StoreName, unknown[]>>): Promise<void> {
    for (const storeName of Object.values(STORES)) {
      const items = data[storeName];
      if (!items) {
        continue;
      }
      await this.runWriteTransaction(storeName, (store) => {
        store.clear();
        for (const item of items) {
          store.put(item);
        }
      });
    }
  }
}
