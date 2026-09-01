import { WaveProgressionConfig } from '../models/training-plan.model';
import { WaveProgressionState } from '../models/wave-progression.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';

export interface WaveProgressionResult {
  achievedReps: number[];
  lastSetWeight: number;
}

export function computeNextWaveProgressionState(
  state: WaveProgressionState,
  config: WaveProgressionConfig,
  result: WaveProgressionResult,
  exerciseCategory: ExerciseWeightCategory,
  incrementOverride?: number
): WaveProgressionState {
  const success = result.achievedReps.every((reps) => reps >= state.currentReps);
  if (!success) {
    // Repeat the same reps/weight next session rather than advancing.
    return { ...state, lastUpdated: new Date() };
  }

  const increment = incrementOverride ?? WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory];

  if (state.currentReps > config.finalReps) {
    // Still descending through this wave: weight climbs, reps step down.
    return {
      ...state,
      currentWeight: state.currentWeight + increment,
      currentReps: Math.max(state.currentReps - config.repsDecrement, config.finalReps),
      lastUpdated: new Date()
    };
  }

  // Bottom of the wave reached: start a new wave one increment above where
  // this one started, at the top of the rep range again.
  const waveStartWeight = state.waveStartWeight + increment;
  return {
    ...state,
    waveStartWeight,
    currentWeight: waveStartWeight,
    currentReps: config.initialReps,
    lastUpdated: new Date()
  };
}
