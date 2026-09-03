import { PlanExerciseConfig, TrainingPlan, WorkingSetTarget } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default GreySkull LP plan across
// installs.
export const DEFAULT_GREYSKULL_PLAN_ID = 'default-plan-greyskull-lp';

// GreySkull LP: 3x/week linear progression, alternating squat/bench/chin-ups
// and squat/overhead-press/deadlift sessions. Each lift is 2 plain sets of 5
// plus an AMRAP top set (the deadlift is just that single top set, run at
// one set for the same fatigue reasons as the 5x5 plan). weightIncrement
// follows the app's usual body-region convention (2.5 lower body, 1 upper
// body) - shown as a value to use, not wired to an active incrementScheme:
// see the plan's own description (TrainingPlansComponent.planDescriptions)
// for why the AMRAP/deload rule stays a manual, "None"-scheme convention
// here rather than mapped onto Linear Progression's own semantics.
const DEFAULT_GREYSKULL_LIFTS: { name: string; workingSets: number; weightIncrement: number }[] = [
  { name: 'Squat', workingSets: 3, weightIncrement: 2.5 },
  { name: 'Bench-Press', workingSets: 3, weightIncrement: 1 },
  { name: 'Chin-Ups', workingSets: 3, weightIncrement: 1 },
  { name: 'Overhead-Press', workingSets: 3, weightIncrement: 1 },
  { name: 'Deadlift', workingSets: 1, weightIncrement: 2.5 }
];

// 2 plain sets of 5 plus an AMRAP top set ('5+') - for the deadlift's single
// set, that means its one set is the AMRAP top set.
function buildWorkingSetTargets(workingSets: number): WorkingSetTarget[] {
  return Array.from({ length: workingSets }, (_, index) => ({
    id: crypto.randomUUID(),
    targetReps: index === workingSets - 1 ? '5+' : '5',
    weight: 0
  }));
}

// Builds the default GreySkull LP plan from whichever of the 5 lifts exist by
// name. Returns null if none of them do (e.g. all were deleted on an
// existing install), rather than seeding an empty default plan.
export function buildDefaultGreyskullPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = DEFAULT_GREYSKULL_LIFTS.map(
    ({ name, workingSets, weightIncrement }): PlanExerciseConfig | null => {
      const exerciseId = exerciseIdByName.get(name);
      if (!exerciseId) {
        return null;
      }
      return {
        exerciseId,
        exerciseType: 'WEIGHT_BASED',
        warmupSets: 0,
        workingSets,
        cooldownSets: 0,
        workingSetTargets: buildWorkingSetTargets(workingSets),
        weightIncrement
      };
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
