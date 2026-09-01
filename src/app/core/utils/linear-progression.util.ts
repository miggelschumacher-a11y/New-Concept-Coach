import { LinearProgressionState } from '../models/linear-progression.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';

export interface LinearProgressionResult {
  lastSetWeight: number;
}

// Each working set now carries its own target-reps text (same as a plan's
// working-set list and a session's own target-reps field), rather than one
// shared range for the whole exercise - so whether the session succeeded is
// decided by the caller (which has each set's own achieved-vs-target
// comparison already) and handed in directly instead of recomputed here.
export function computeNextLinearProgressionState(
  state: LinearProgressionState,
  success: boolean,
  result: LinearProgressionResult,
  exerciseCategory: ExerciseWeightCategory,
  incrementOverride?: number
): LinearProgressionState {
  if (!success) {
    // Repeat the same weight next session rather than advancing.
    return { ...state, lastUpdated: new Date() };
  }
  return {
    ...state,
    currentWeight: result.lastSetWeight + (incrementOverride ?? WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory]),
    lastUpdated: new Date()
  };
}
