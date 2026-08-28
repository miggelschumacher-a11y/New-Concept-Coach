import { PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default 5x5 plan across installs.
export const DEFAULT_5X5_PLAN_ID = 'default-plan-5x5-strength';

// Classic 5x5 linear-progression strength training: 5 sets of 5 on the main
// lifts, except the deadlift, which is conventionally done for a single
// heavy set of 5 since it's far more fatiguing to recover from than the
// others. Generic principle, not tied to any specific commercial program.
const DEFAULT_5X5_LIFTS: { name: string; workingSets: number }[] = [
  { name: 'Squat', workingSets: 5 },
  { name: 'Bench-Press', workingSets: 5 },
  { name: 'Barbell-Row', workingSets: 5 },
  { name: 'Overhead-Press', workingSets: 5 },
  { name: 'Deadlift', workingSets: 1 }
];

// Builds the default 5x5 plan from whichever of the 5 lifts exist by name.
// Returns null if none of them do (e.g. all were deleted on an existing
// install), rather than seeding an empty default plan.
export function buildDefault5x5Plan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = DEFAULT_5X5_LIFTS.map(
    ({ name, workingSets }): PlanExerciseConfig | null => {
      const exerciseId = exerciseIdByName.get(name);
      return exerciseId ? { exerciseId, exerciseType: 'WEIGHT_BASED', warmupSets: 0, workingSets, cooldownSets: 0 } : null;
    }
  ).filter((config): config is PlanExerciseConfig => !!config);

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_5X5_PLAN_ID,
    name: '5x5 Strength',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    isDefault: true
  };
}
