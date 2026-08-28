import { LinearProgressionConfig } from '../models/training-plan.model';
import { LinearProgressionState } from '../models/linear-progression.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';
import { parseRepsRange } from './reps-range.util';

export interface LinearProgressionResult {
  achievedReps: number[];
  lastSetWeight: number;
}

export function computeNextLinearProgressionState(
  state: LinearProgressionState,
  config: LinearProgressionConfig,
  result: LinearProgressionResult,
  exerciseCategory: ExerciseWeightCategory
): LinearProgressionState {
  const range = parseRepsRange(config.targetReps);
  const requiredReps = config.lowerBoundSufficient ? range.min : range.max;
  const success = result.achievedReps.every((reps) => reps >= requiredReps);
  if (!success) {
    // Repeat the same weight next session rather than advancing.
    return { ...state, lastUpdated: new Date() };
  }
  return {
    ...state,
    currentWeight: result.lastSetWeight + WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory],
    lastUpdated: new Date()
  };
}
