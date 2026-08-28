import { PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default GreySkull LP plan across
// installs.
export const DEFAULT_GREYSKULL_PLAN_ID = 'default-plan-greyskull-lp';

// GreySkull LP: 3x/week linear progression, alternating squat/bench/chin-ups
// and squat/overhead-press/deadlift sessions. Each lift is 2 sets of 5 plus
// an AMRAP top set, except the deadlift, run for a single set like in the
// 5x5 plan for the same fatigue reasons. The model has no dedicated AMRAP
// flag for weight-based sets, so — like the 5x5 plan — this seeds the set
// count only; the AMRAP nature of the last set is left to the user to apply.
const DEFAULT_GREYSKULL_LIFTS: { name: string; workingSets: number }[] = [
  { name: 'Squat', workingSets: 3 },
  { name: 'Bench-Press', workingSets: 3 },
  { name: 'Chin-Ups', workingSets: 3 },
  { name: 'Overhead-Press', workingSets: 3 },
  { name: 'Deadlift', workingSets: 1 }
];

// Builds the default GreySkull LP plan from whichever of the 5 lifts exist by
// name. Returns null if none of them do (e.g. all were deleted on an
// existing install), rather than seeding an empty default plan.
export function buildDefaultGreyskullPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = DEFAULT_GREYSKULL_LIFTS.map(
    ({ name, workingSets }): PlanExerciseConfig | null => {
      const exerciseId = exerciseIdByName.get(name);
      return exerciseId ? { exerciseId, exerciseType: 'WEIGHT_BASED', warmupSets: 0, workingSets, cooldownSets: 0 } : null;
    }
  ).filter((config): config is PlanExerciseConfig => !!config);

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_GREYSKULL_PLAN_ID,
    // Attributed by name, same reasoning applied to 5/3/1: the methodology is
    // free to use, but crediting the creator is good practice.
    name: 'GreySkull LP (John Sheaffer)',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    isDefault: true
  };
}
