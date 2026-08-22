import { TIER_LINE_SCHEME } from '../data/tier-line-scheme';
import { GzclTier, TierLineStage, TierLineProgressionState } from '../models/tier-line-progression.model';

export interface SessionResult {
  achievedReps: number[]; // Reps je Satz der letzten Session
}

const WEIGHT_INCREMENT: Record<GzclTier, number> = {
  [GzclTier.T1_MAIN]: 2.5,
  [GzclTier.T2_SECONDARY]: 2.5,
  [GzclTier.T3_ACCESSORY]: 1.25
};

const DELOAD_FACTOR = 0.9; // 10% Reduktion bei Reset nach Stage 3

const FAIL_THRESHOLD = 2; // 2x Fail in Folge -> Stage-Wechsel

export function computeNextTierLineState(
  state: TierLineProgressionState,
  result: SessionResult
): TierLineProgressionState {
  const scheme = TIER_LINE_SCHEME[state.tier][state.stage];
  const lastSetReps = result.achievedReps[result.achievedReps.length - 1];

  const success = scheme.isAmrapLastSet
    ? lastSetReps >= scheme.targetReps
    : result.achievedReps.every(r => r >= scheme.targetReps);

  if (success) {
    return {
      ...state,
      currentWeight: state.currentWeight + WEIGHT_INCREMENT[state.tier],
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
