import { DoubleProgressionConfig } from '../models/training-plan.model';
import { DoubleProgressionState } from '../models/double-progression.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';

// How many reps a single set can climb within one weight cycle before every
// set has reached upperReps and a weight increase is due.
function cycleCapacity(config: DoubleProgressionConfig, workingSets: number): number {
  const range = config.upperReps - config.lowerReps;
  return config.mode === 'ADD_TO_ALL_SETS' ? range : range * workingSets;
}

// Prescribed reps per working set for the given state, in set order.
export function computePrescribedReps(
  config: DoubleProgressionConfig,
  repsAddedThisCycle: number,
  workingSets: number
): number[] {
  if (workingSets <= 0) {
    return [];
  }
  if (config.mode === 'ADD_TO_ALL_SETS') {
    const reps = config.lowerReps + repsAddedThisCycle;
    return Array.from({ length: workingSets }, () => reps);
  }
  // ADD_ONE_TOTAL_REP: one extra rep lands on one more set each session,
  // round-robin, until every set has caught up — then the base level rises.
  const fullRounds = Math.floor(repsAddedThisCycle / workingSets);
  const setsAheadByOne = repsAddedThisCycle % workingSets;
  const base = config.lowerReps + fullRounds;
  return Array.from({ length: workingSets }, (_, index) => (index < setsAheadByOne ? base + 1 : base));
}

export interface DoubleProgressionResult {
  achievedReps: number[];
  lastSetWeight: number;
}

export function computeNextDoubleProgressionState(
  state: DoubleProgressionState,
  config: DoubleProgressionConfig,
  result: DoubleProgressionResult,
  exerciseCategory: ExerciseWeightCategory,
  // Per-exercise override for the weight step on a successful cycle reset -
  // falls back to the fixed body-region default when unset.
  incrementOverride?: number
): DoubleProgressionState {
  const workingSets = result.achievedReps.length;
  const prescribedReps = computePrescribedReps(config, state.repsAddedThisCycle, workingSets);
  const success = result.achievedReps.every((reps, index) => reps >= prescribedReps[index]);

  if (!success) {
    // Repeat the same reps/weight next session rather than advancing.
    return { ...state, lastUpdated: new Date() };
  }

  const capacity = cycleCapacity(config, workingSets);
  const nextRepsAdded = state.repsAddedThisCycle + 1;

  if (nextRepsAdded > capacity) {
    // Every set has reached upperReps — reset to the bottom of the range
    // and increase the weight, building on what was actually lifted.
    return {
      ...state,
      currentWeight: result.lastSetWeight + (incrementOverride ?? WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory]),
      repsAddedThisCycle: 0,
      lastUpdated: new Date()
    };
  }

  return { ...state, repsAddedThisCycle: nextRepsAdded, lastUpdated: new Date() };
}
