import { RepGoalConfig } from '../models/training-plan.model';
import { RepGoalState } from '../models/rep-goal.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';

export interface RepGoalResult {
  // Sum of reps across all working sets in the finished session.
  totalReps: number;
  lastSetWeight: number;
}

export function computeNextRepGoalState(
  state: RepGoalState,
  config: RepGoalConfig,
  result: RepGoalResult,
  exerciseCategory: ExerciseWeightCategory
): RepGoalState {
  if (result.totalReps <= config.totalRepGoal) {
    // Goal not surpassed: repeat the same weight next session.
    return { ...state, lastUpdated: new Date() };
  }
  return {
    ...state,
    currentWeight: result.lastSetWeight + WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory],
    lastUpdated: new Date()
  };
}
