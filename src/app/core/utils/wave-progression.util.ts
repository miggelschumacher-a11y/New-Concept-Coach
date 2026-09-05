import { WaveProgressionConfig } from '../models/training-plan.model';
import { WaveProgressionState } from '../models/wave-progression.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { applyWeightIncrement, IncrementType, WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from './tier-line-progression.util';

export interface WaveProgressionResult {
  achievedReps: number[];
  lastSetWeight: number;
}

export function computeNextWaveProgressionState(
  state: WaveProgressionState,
  config: WaveProgressionConfig,
  result: WaveProgressionResult,
  exerciseCategory: ExerciseWeightCategory,
  incrementOverride?: number,
  incrementType?: IncrementType
): WaveProgressionState {
  const success = result.achievedReps.every((reps) => reps >= state.currentReps);
  if (!success) {
    // Repeat the same reps/weight next session rather than advancing - from
    // the weight actually just lifted, not the state's own cached
    // currentWeight, which can otherwise drift and go stale.
    return { ...state, currentWeight: result.lastSetWeight, lastUpdated: new Date() };
  }

  const increment = incrementOverride ?? WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory];

  if (state.currentReps > config.finalReps) {
    // Still descending through this wave: weight climbs, reps step down.
    return {
      ...state,
      currentWeight: applyWeightIncrement(state.currentWeight, increment, incrementType),
      currentReps: Math.max(state.currentReps - config.repsDecrement, config.finalReps),
      lastUpdated: new Date()
    };
  }

  // Bottom of the wave reached: start a new wave one increment above where
  // this one started, at the top of the rep range again.
  const waveStartWeight = applyWeightIncrement(state.waveStartWeight, increment, incrementType);
  return {
    ...state,
    waveStartWeight,
    currentWeight: waveStartWeight,
    currentReps: config.initialReps,
    lastUpdated: new Date()
  };
}
