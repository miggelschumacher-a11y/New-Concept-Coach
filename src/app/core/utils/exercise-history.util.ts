import { ExerciseSet, SessionExercise, TrainingSession } from '../models/session.model';
import { DoubleWeightCountingSource, liftedWeight } from './one-rep-max.util';

// Whether a set feeds an exercise's totals/charts: only sets of a type whose
// "count warm-up/working/cooldown sets" setting is on for its session
// exercise (working sets count unless explicitly turned off, same default as
// SessionsComponent.countedSets).
export function isSetCounted(sessionExercise: SessionExercise, set: ExerciseSet): boolean {
  if (set.type === 'warmup') {
    return sessionExercise.countWarmupSets;
  }
  if (set.type === 'cooldown') {
    return sessionExercise.countCooldownSets;
  }
  return sessionExercise.countWorkingSets ?? true;
}

export interface ExerciseHistorySet {
  reps: number;
  weight: number;
  seconds: number;
  timeBased: boolean;
}

export interface ExerciseHistoryEntry {
  sessionId: string;
  date: string;
  sessionName: string;
  sets: ExerciseHistorySet[];
  // Reps x weight summed over the weight-based sets (doubled where the set
  // counts double, see liftedWeight); seconds summed over the time-based ones.
  // A session can hold both when a Time-Based warm-up/cooldown set sits in an
  // otherwise weight-based exercise.
  totalWeight: number;
  totalSeconds: number;
  hasWeightSets: boolean;
  hasTimeSets: boolean;
}

// Every session's completed, counted sets of one exercise, newest session
// first. A set belongs to the exercise it is actually for - its own
// referenceExerciseId if it has one (a legacy warm-up/cooldown set added for
// a different exercise), otherwise the exercise that owns its SessionExercise.
export function buildExerciseHistory(
  exerciseId: string,
  exercise: DoubleWeightCountingSource | undefined,
  sessions: TrainingSession[]
): ExerciseHistoryEntry[] {
  const entries: ExerciseHistoryEntry[] = [];
  for (const session of sessions) {
    const sets: ExerciseHistorySet[] = [];
    let totalWeight = 0;
    for (const sessionExercise of session.exercises) {
      for (const set of sessionExercise.sets) {
        if (!set.done || (set.referenceExerciseId ?? sessionExercise.exerciseId) !== exerciseId || !isSetCounted(sessionExercise, set)) {
          continue;
        }
        const timeBased = set.isTimeBased ?? sessionExercise.exerciseType === 'TIME_BASED';
        sets.push({
          reps: set.reps,
          weight: timeBased ? 0 : set.weight,
          seconds: timeBased ? (set.seconds ?? 0) : 0,
          timeBased
        });
        if (!timeBased) {
          totalWeight += set.reps * liftedWeight(exercise ?? {}, set.weight, set.doubleWeightCounting);
        }
      }
    }
    if (sets.length === 0) {
      continue;
    }
    entries.push({
      sessionId: session.id,
      date: session.date,
      sessionName: session.name,
      sets,
      totalWeight,
      totalSeconds: sets.reduce((sum, set) => sum + set.seconds, 0),
      hasWeightSets: sets.some((set) => !set.timeBased),
      hasTimeSets: sets.some((set) => set.timeBased)
    });
  }
  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
