import { TIER_LINE_SCHEME } from '../data/tier-line-scheme';
import { TierLineStage, TierLineProgressionState } from '../models/tier-line-progression.model';

export interface SessionResult {
  achievedReps: number[]; // Reps je Satz der letzten Session
}

export type ExerciseWeightCategory = 'LOWER_BODY' | 'UPPER_BODY';

const WEIGHT_INCREMENT_BY_EXERCISE_TYPE: Record<ExerciseWeightCategory, number> = {
  LOWER_BODY: 2.5, // kg, z.B. Kniebeuge, Kreuzheben
  UPPER_BODY: 1.25 // kg, z.B. Bankdrücken, Schulterdrücken
};

const DELOAD_FACTOR = 0.9; // 10% Reduktion bei Reset nach Stage 3

const FAIL_THRESHOLD = 2; // 2x Fail in Folge -> Stage-Wechsel

export function computeNextTierLineState(
  state: TierLineProgressionState,
  result: SessionResult,
  exerciseCategory: ExerciseWeightCategory
): TierLineProgressionState {
  const scheme = TIER_LINE_SCHEME[state.tier][state.stage];
  const lastSetReps = result.achievedReps[result.achievedReps.length - 1];

  const success = scheme.isAmrapLastSet
    ? lastSetReps >= scheme.targetReps
    : result.achievedReps.every(r => r >= scheme.targetReps);

  if (success) {
    return {
      ...state,
      currentWeight: state.currentWeight + WEIGHT_INCREMENT_BY_EXERCISE_TYPE[exerciseCategory],
      consecutiveFails: 0,
      lastUpdated: new Date()
    };
  }

  const fails = state.consecutiveFails + 1;

  if (fails < FAIL_THRESHOLD) {
    // Erster Fehlschlag: gleiches Gewicht nochmal versuchen
    return { ...state, consecutiveFails: fails, lastUpdated: new Date() };
  }

  // Zweiter Fehlschlag in Folge: Stage wechseln (oder Reset bei Stage 3)
  if (state.stage === TierLineStage.STAGE_3) {
    return {
      ...state,
      stage: TierLineStage.STAGE_1,
      currentWeight: Math.round(state.currentWeight * DELOAD_FACTOR),
      consecutiveFails: 0,
      lastUpdated: new Date()
    };
  }

  const nextStage = state.stage === TierLineStage.STAGE_1
    ? TierLineStage.STAGE_2
    : TierLineStage.STAGE_3;

  return {
    ...state,
    stage: nextStage,
    consecutiveFails: 0,
    lastUpdated: new Date()
  };
}
