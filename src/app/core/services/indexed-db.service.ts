import { Injectable } from '@angular/core';
import { Exercise } from '../models/exercise.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { buildDefault531Plan } from '../data/default-531-plan';
import { buildDefault5x5Plan } from '../data/default-5x5-plan';
import { buildDefaultGzclpPlan } from '../data/default-gzclp-plan';
import { buildDefaultGreyskullPlan } from '../data/default-greyskull-plan';
import { buildDefaultNsunsPlan } from '../data/default-nsuns-plan';
import { buildDefaultHeavyDutyPlan } from '../data/default-heavyduty-plan';
import { buildDefaultHstPlan } from '../data/default-hst-plan';

const DB_NAME = 'trainings-app-db';
// Bumped from 28 with no new store/content of its own - some installs ended
// up stuck at 28 with linearProgression missing (its own bump's upgrade
// transaction never completed there), and a same-version reopen can't
// trigger onupgradeneeded to self-heal that. Forcing everyone through one
// more upgrade re-runs the "create any store not already present" loop
// below, which fixes those installs too.
// Jumped straight to 32 (skipping 30/31) because a live-reload during local
// testing briefly pushed those version numbers to an already-open real
// browser tab sharing this dev server, bumping its on-disk DB past 29 -
// IndexedDB never opens at a version lower than what's already stored, so
// this has to clear whatever the highest such leak reached.
// 33: re-seeds GZCLP with its now-stable day-template ids (see
// default-gzclp-plan.ts) - the reseed step below only runs on an actual
// upgrade, so this needs its own bump to take effect for existing installs.
// 34: backfills body region on the remaining default exercises and adds
// sourced description/photo content for Bench-Press and AB-Wheel (see
// DEFAULT_EXERCISE_SOURCED_CONTENT) - needs its own bump so every existing
// install picks this up on next load, not just brand-new ones.
// 35: the 34 backfill was landed as several separate file edits, each its
// own dev-server rebuild/live-reload - a real, already-open browser tab
// sharing this dev server could have reloaded on an intermediate edit
// (DB_VERSION already 34, backfill body not yet added), permanently
// advancing its stored version past the `< DB_VERSION` gate without the
// backfill ever running (same race as the 32/33 bumps above). Re-fires it
// for anyone caught in that gap.
// 36: verified locally that the 34/35 backfill correctly fills in genuinely
// empty fields (not just no-ops on already-healed rows).
// 37: adds sourced description/photo content for Cable-Row and Calf-Raises
// too (same DEFAULT_EXERCISE_SOURCED_CONTENT backfill as 34/35/36).
const DB_VERSION = 37;

const DEFAULT_PLAN_BUILDERS = [
  buildDefault531Plan,
  buildDefault5x5Plan,
  buildDefaultGzclpPlan,
  buildDefaultGreyskullPlan,
  buildDefaultNsunsPlan,
  buildDefaultHeavyDutyPlan,
  buildDefaultHstPlan
];

export const STORES = {
  exercises: 'exercises',
  trainingPlans: 'trainingPlans',
  sessions: 'sessions',
  settings: 'settings',
  tierLineProgression: 'tierLineProgression',
  bodyWeightEntries: 'bodyWeightEntries',
  doubleProgression: 'doubleProgression',
  repGoalProgression: 'repGoalProgression',
  waveProgression: 'waveProgression',
  linearProgression: 'linearProgression'
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
// Every default exercise gets a sensible region so the Config page's
// "Body Region" dropdown never starts blank - classified by primary muscle
// group, with core/neck work bucketed under Upper Body since the field is
// binary.
const DEFAULT_EXERCISE_WEIGHT_CATEGORIES: Partial<Record<string, ExerciseWeightCategory>> = {
  Squat: 'LOWER_BODY',
  Deadlift: 'LOWER_BODY',
  'Bench-Press': 'UPPER_BODY',
  'Overhead-Press': 'UPPER_BODY',
  'Cable-Row': 'UPPER_BODY',
  'Triceps-Push-Down': 'UPPER_BODY',
  'Chin-Ups': 'UPPER_BODY',
  'Pull-Ups': 'UPPER_BODY',
  'Cable-Push-Down': 'UPPER_BODY',
  'AB-Wheel': 'UPPER_BODY',
  'Chest-Supported-Rows': 'UPPER_BODY',
  'Barbell-Row': 'UPPER_BODY',
  Dips: 'UPPER_BODY',
  'Bent-Over-Dumbbell-Raise': 'UPPER_BODY',
  'Standing-Leg-Curls': 'LOWER_BODY',
  'AB-Rollout': 'UPPER_BODY',
  'Back-Extension': 'LOWER_BODY',
  'Lat-Pull-Downs': 'UPPER_BODY',
  'Neck-Curls': 'UPPER_BODY',
  'Calf-Raises': 'LOWER_BODY',
  'Neck-Extensions': 'UPPER_BODY'
};

interface SourcedExerciseContent {
  description: string;
  sourceImageUrl: string;
  sourceLicense: string;
  sourceAttribution: string;
  sourceUrl: string;
}

// Execution photo + description sourced from wger.de (an open, CC-BY-SA
// licensed exercise database) for the handful of default exercises with a
// confident, well-matched entry there - see ExercisesComponent for the
// fallback animated pictogram every other exercise uses instead. Photos are
// bundled locally under public/exercise-images rather than hotlinked, since
// wger.de doesn't reliably serve them to every network.
const DEFAULT_EXERCISE_SOURCED_CONTENT: Partial<Record<string, SourcedExerciseContent>> = {
  'Bench-Press': {
    description:
      'Lege dich auf die Bank, die Stange direkt über die Augen, die Knie etwas angewinkelt und die Füße fest auf dem Boden. Greife die Stange breit und lasse sie langsam und kontrolliert runter, dabei sollte die Stange kurz auf Brustwarzenhöhe den Körper berühren. Dann das Gewicht wieder hochdrücken bis die Arme durchgestreckt sind.\n\nBei hohem Gewicht, empfielt sich natürlich einen Spotter zu haben, der einen hilft falls man die Stange nicht alleine hochdrücken kann.\n\nMit der Breite des Griffs kann außerdem kontrolliert werden, welcher Bereich der Brust stärker belastet wird:\n\n* breiter Griff: äußere Brustmuskeln\n* enger Griff: innere Brustmuskeln und Trizeps',
    sourceImageUrl: '/exercise-images/bench-press.png',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'Everkinetic',
    sourceUrl: 'https://wger.de/en/exercise/73/view/'
  },
  'AB-Wheel': {
    description:
      'Ausgangsposition: Knie dich auf den Boden, mit dem Bauchroller vor dir. Greife den Roller: Halte die Griffe fest. Ausrollen: Rolle den Roller langsam nach vorn und strecke deinen Körper aus, während du den Rumpf angespannt hältst. Zurückkehren: Ziehe den Roller wieder zurück zu deinen Knien und halte die Spannung im Rumpf.',
    sourceImageUrl: '/exercise-images/ab-wheel.png',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'lhegedus',
    sourceUrl: 'https://wger.de/en/exercise/1573/view/'
  },
  'Cable-Row': {
    description:
      '1. Setze dich auf die Maschine, die Füße fest aufgesetzt und etwas mehr als schulterbreit. Drücke über die Fersen und spanne die Gesäßmuskulatur an. Greife den Kabelgriff.\n2. Sitze aufrecht mit leicht gebeugten Knien. Spanne Bauch und unteren Rücken an, um mit deinem Oberkörper einen rechten Winkel zum Boden zu halten.\n3. Rolle die Schultern nach hinten und unten. Ziehe sie beim Rudern zusammen und stelle dir vor, du würdest einen Stift zwischen ihnen einklemmen. Ziehe dabei den Griff zu dir heran, bis er knapp oberhalb deines Bauchnabels ankommt.\n4. Halte hier einen Moment inne, bevor du den Griff zurückführst, während du die Schulterblätter weiterhin zusammendrückst. Sobald du das Gewicht zum Stapel zurückgeführt hast, lass die Schulterblätter entspannen, ohne den Oberkörper nach vorne zu ziehen.\n5. Wiederhole die Bewegung.',
    sourceImageUrl: '/exercise-images/cable-row.jpg',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'Franpol',
    sourceUrl: 'https://wger.de/en/exercise/1117/view/'
  },
  'Calf-Raises': {
    description:
      'Die Füße werden auf die in der Maschine dafür vorgesehene Stelle positioniert, wobei man die Fersen (und damit die Wadenmuskeln) komplett nach unten austrecken kann. Halte den Körper gerade, mache kein Hohlkreuz und beuge die Beine nicht.\n\nZiehe nun die Wadenmuskeln zusammen und gehe so hoch es geht. Mache auf dem höchsten Punkt eine kurze Pause (1-2 sek.) und gehe dann runter.',
    sourceImageUrl: '/exercise-images/calf-raises.jpeg',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'clafal',
    sourceUrl: 'https://wger.de/en/exercise/622/view/'
  }
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
            const sourced = DEFAULT_EXERCISE_SOURCED_CONTENT[name];
            const exercise: Exercise = {
              id: crypto.randomUUID(),
              name,
              category: '',
              weightCategory: DEFAULT_EXERCISE_WEIGHT_CATEGORIES[name],
              ...(sourced
                ? {
                    description: sourced.description,
                    sourceImageUrl: sourced.sourceImageUrl,
                    sourceLicense: sourced.sourceLicense,
                    sourceAttribution: sourced.sourceAttribution,
                    sourceUrl: sourced.sourceUrl
                  }
                : {})
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

          if (event.oldVersion < DB_VERSION && db.objectStoreNames.contains(STORES.exercises)) {
            // Self-healing backfill: fills in body region and sourced
            // description/photo for the built-in exercises whenever that
            // field is still empty, without touching anything the user has
            // already changed - per-field rather than whole-record (unlike
            // the training-plan reseed below) since these rows aren't
            // read-only and can carry real user edits.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.openCursor().onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
              if (!cursor) {
                return;
              }
              const exercise = cursor.value as Exercise;
              const defaultCategory = DEFAULT_EXERCISE_WEIGHT_CATEGORIES[exercise.name];
              const sourced = DEFAULT_EXERCISE_SOURCED_CONTENT[exercise.name];
              let updated = exercise;
              if (defaultCategory && !updated.weightCategory) {
                updated = { ...updated, weightCategory: defaultCategory };
              }
              if (sourced && !updated.sourceImageUrl) {
                updated = {
                  ...updated,
                  description: updated.description ?? sourced.description,
                  sourceImageUrl: sourced.sourceImageUrl,
                  sourceLicense: sourced.sourceLicense,
                  sourceAttribution: sourced.sourceAttribution,
                  sourceUrl: sourced.sourceUrl
                };
              }
              if (updated !== exercise) {
                cursor.update(updated);
              }
              cursor.continue();
            };
          }

          if (
            // Always compares against the live DB_VERSION constant rather
            // than a hardcoded number that must be bumped in lockstep — a
            // mismatch here once let a live-reload race skip this backfill
            // for an already-open real browser, permanently missing a content
            // update (see project memory: default-training-plans).
            event.oldVersion < DB_VERSION &&
            db.objectStoreNames.contains(STORES.exercises) &&
            db.objectStoreNames.contains(STORES.trainingPlans)
          ) {
            // Seed the default plans (5/3/1, 5x5, GZCLP, GreySkull LP, nSuns,
            // Heavy Duty, HST) for existing installs too, looking up the lift
            // ids by name since they're randomly generated per install.
            // Re-running this is harmless/idempotent (put), so it also
            // re-adds any default plan a restore/import may have dropped, and
            // picks up content changes (e.g. attribution added to a plan's
            // name) that the self-healing
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

      request.onsuccess = () => {
        const db = request.result;
        // A long-lived tab (this app's dev server hot-reloads code without a
        // full page refresh, so a tab can stay open across many schema
        // bumps) keeps this exact connection object even after a later
        // version adds a new store elsewhere - without closing it here,
        // every future open() for that newer version stays stuck "blocked"
        // forever, and this connection's own transaction() calls keep
        // throwing NotFoundError for any store added since it was opened.
        // Closing lets the newer open() proceed; getStore()'s callers still
        // need a fresh page load to pick up a new dbPromise pointing at it.
        db.onversionchange = () => db.close();
        resolve(db);
      };
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
