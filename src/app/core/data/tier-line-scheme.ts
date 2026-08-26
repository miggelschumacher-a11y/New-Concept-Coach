import { GzclTier, TierLineStage, TierLineSetScheme } from '../models/tier-line-progression.model';

export const TIER_LINE_SCHEME: Record<GzclTier, Record<TierLineStage, TierLineSetScheme>> = {
  [GzclTier.T1_MAIN]: {
    [TierLineStage.STAGE_1]: { sets: 5, targetReps: 3, isAmrapLastSet: true },
    [TierLineStage.STAGE_2]: { sets: 6, targetReps: 2, isAmrapLastSet: true },
    [TierLineStage.STAGE_3]: { sets: 10, targetReps: 1, isAmrapLastSet: true }
  },
  [GzclTier.T2_SECONDARY]: {
    [TierLineStage.STAGE_1]: { sets: 3, targetReps: 10, isAmrapLastSet: false },
    [TierLineStage.STAGE_2]: { sets: 3, targetReps: 8, isAmrapLastSet: false },
    [TierLineStage.STAGE_3]: { sets: 3, targetReps: 6, isAmrapLastSet: false }
  },
  [GzclTier.T3_ACCESSORY]: {
    [TierLineStage.STAGE_1]: { sets: 3, targetReps: 15, isAmrapLastSet: true },
    [TierLineStage.STAGE_2]: { sets: 3, targetReps: 15, isAmrapLastSet: true },
    [TierLineStage.STAGE_3]: { sets: 3, targetReps: 15, isAmrapLastSet: true }
  }
};
