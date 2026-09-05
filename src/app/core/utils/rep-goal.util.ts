import { RepGoalConfig } from '../models/training-plan.model';
import { RepGoalState } from '../models/rep-goal.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { applyWeightIncrement, IncrementType, WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';

export interface RepGoalResult {
  // Sum of reps across all working sets in the finished session.
  totalReps: number;
  lastSetWeight: number;
}

export function computeNextRepGoalState(
  state: RepGoalState,
  config: RepGoalConfig,
  result: RepGoalResult,
  exerciseCategory: ExerciseWeightCategory,
  incrementOverride?: number,
  incrementType?: IncrementType
): RepGoalState {
  if (result.totalReps <= config.totalRepGoal) {
    // Goal not surpassed: repeat the same weight next session - from the
    // weight actually just lifted, not the state's own cached currentWeight,
    // which can otherwise drift and go stale.
    return { ...state, currentWeight: result.lastSetWeight, lastUpdated: new Date() };
  }
  return {
    ...state,
    currentWeight: applyWeightIncrement(
      result.lastSetWeight,
      incrementOverride ?? WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory],
      incrementType
    ),
    lastUpdated: new Date()
  };
}
