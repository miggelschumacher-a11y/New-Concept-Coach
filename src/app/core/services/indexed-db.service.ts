import { Injectable } from '@angular/core';
import { Exercise } from '../models/exercise.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { PercentageWeek, PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

const DB_NAME = 'trainings-app-db';
const DB_VERSION = 10;

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

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default 5/3/1 plan across installs.
const DEFAULT_531_PLAN_ID = 'default-plan-531-powerlifting';

const DEFAULT_531_LIFT_NAMES = ['Squat', 'Bench-Press', 'Deadlift', 'Overhead-Press'];

// Classic Wendler 5/3/1: 3 waves building to a heavier AMRAP top set, then a
// deload week.
const DEFAULT_531_PERCENTAGE_WEEKS: PercentageWeek[] = [
  {
    sets: [
      { percentage: 65, reps: 5, isAmrap: false },
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 5, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 70, reps: 3, isAmrap: false },
      { percentage: 80, reps: 3, isAmrap: false },
      { percentage: 90, reps: 3, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 3, isAmrap: false },
      { percentage: 95, reps: 1, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 40, reps: 5, isAmrap: false },
      { percentage: 50, reps: 5, isAmrap: false },
      { percentage: 60, reps: 5, isAmrap: false }
    ]
  }
];

const DEFAULT_531_PLAN_DESCRIPTION =
  'Klassisches Wendler 5/3/1: 4-Wochen-Zyklus (3 Aufbauwochen + Deload-Woche) für Squat, ' +
  'Bankdrücken, Kreuzheben und Overhead-Press, basierend auf Prozentsätzen des 1RM.';

// Builds the default 5/3/1 plan from whichever of the 4 lifts exist by name.
// Returns null if none of them do (e.g. all were deleted on an existing
// install), rather than seeding an empty default plan.
function buildDefault531Plan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseIds = DEFAULT_531_LIFT_NAMES.map((name) => exerciseIdByName.get(name)).filter(
    (id): id is string => !!id
  );
  if (exerciseIds.length === 0) {
    return null;
  }
  const exerciseConfigs: PlanExerciseConfig[] = exerciseIds.map((exerciseId) => ({
    exerciseId,
    exerciseType: 'PERCENTAGE_BASED',
    warmupSets: 0,
    workingSets: 3,
    cooldownSets: 0,
    percentageWeeks: DEFAULT_531_PERCENTAGE_WEEKS.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) }))
  }));
  return {
    id: DEFAULT_531_PLAN_ID,
    name: '5/3/1 Powerlifting',
    description: DEFAULT_531_PLAN_DESCRIPTION,
    exerciseIds,
    exerciseConfigs,
    isDefault: true
  };
}

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
          const defaultPlan = buildDefault531Plan(exerciseIdByName);
          if (defaultPlan) {
            request.transaction!.objectStore(STORES.trainingPlans).put(defaultPlan);
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
            event.oldVersion < 10 &&
            db.objectStoreNames.contains(STORES.exercises) &&
            db.objectStoreNames.contains(STORES.trainingPlans)
          ) {
            // Seed the default 5/3/1 plan for existing installs too, looking up
            // the lift ids by name since they're randomly generated per install.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.getAll().onsuccess = (getAllEvent) => {
              const allExercises = (getAllEvent.target as IDBRequest<Exercise[]>).result;
              const exerciseIdByName = new Map(allExercises.map((exercise) => [exercise.name, exercise.id]));
              const defaultPlan = buildDefault531Plan(exerciseIdByName);
              if (defaultPlan) {
                request.transaction!.objectStore(STORES.trainingPlans).put(defaultPlan);
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
