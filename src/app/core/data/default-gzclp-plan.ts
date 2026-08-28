import { TrainingPlan } from '../models/training-plan.model';
import { GzclTier, TierLineStage, TrainingMethodology } from '../models/tier-line-progression.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default GZCLP plan across installs.
export const DEFAULT_GZCLP_PLAN_ID = 'default-plan-gzclp';

// Classic GZCLP: a 4-day T1/T2/T3 tier rotation (Day A1-B1-A2-B2) where squat,
// bench press, deadlift, and overhead press alternate between T1 (main lift,
// 5x3+) and T2 (secondary, 3x10) roles, with lat pull-downs as a constant T3
// accessory (3x15).
export function buildDefaultGzclpPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const squat = exerciseIdByName.get('Squat');
  const bench = exerciseIdByName.get('Bench-Press');
  const deadlift = exerciseIdByName.get('Deadlift');
  const ohp = exerciseIdByName.get('Overhead-Press');
  const latPullDowns = exerciseIdByName.get('Lat-Pull-Downs');
  if (!squat || !bench || !deadlift || !ohp || !latPullDowns) {
    return null;
  }

  const accessory = {
    exerciseId: latPullDowns,
    tier: GzclTier.T3_ACCESSORY,
    stage: TierLineStage.STAGE_1,
    sets: 3,
    targetReps: '15'
  };
  const day = (order: number, name: string, t1: string, t2: string) => ({
    id: crypto.randomUUID(),
    name,
    order,
    exercises: [
      { exerciseId: t1, tier: GzclTier.T1_MAIN, stage: TierLineStage.STAGE_1, sets: 5, targetReps: '3' },
      { exerciseId: t2, tier: GzclTier.T2_SECONDARY, stage: TierLineStage.STAGE_1, sets: 3, targetReps: '10' },
      { ...accessory }
    ]
  });

  return {
    id: DEFAULT_GZCLP_PLAN_ID,
    name: 'GZCLP',
    exerciseIds: [squat, deadlift, bench, ohp, latPullDowns],
    methodology: TrainingMethodology.TIER_LINE_PROGRESSION,
    planSessions: [
      day(0, 'Tag A1', squat, bench),
      day(1, 'Tag B1', ohp, deadlift),
      day(2, 'Tag A2', bench, squat),
      day(3, 'Tag B2', deadlift, ohp)
    ],
    isDefault: true
  };
}
