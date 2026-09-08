import { PlanExerciseConfig, TrainingPlan, WorkingSetTarget } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default GVT plan across installs.
export const DEFAULT_GVT_PLAN_ID = 'default-plan-german-volume-training';

// German Volume Training: 10 sets of 10 reps per main lift at a weight the
// user can hold for all 10x10, increased once that becomes stable - a
// generic, decades-old training method (popularized in the West by Charles
// Poliquin, not owned by him), same uncontroversial category as the 5x5
// plan. weight starts at 0 (the user picks their own working weight, same
// convention as GreySkull's workingSetTargets) and weightIncrement follows
// the app's usual body-region convention (2.5 lower body, 1 upper body).
// Modeled as one exercise per session (oneExercisePerSession, same trick
// 5/3/1 uses for its one-lift-per-day split) since the plan model has no
// "N exercises share a day" grouping outside GZCL's tier-line sessions -
// exercises are ordered here by day, so pairing/tripling consecutive
// sessions in one gym visit reproduces the intended 3-day split:
// Day 1 (Chest/Back): Bench-Press, Lat-Pull-Downs
// Day 2 (Legs/Abs): Squat, Leg-Press, AB-Wheel
// Day 3 (Shoulders/Arms): Overhead-Press, Bicep-Curls, Triceps-Push-Down
const DEFAULT_GVT_LIFTS: { name: string; workingSets: number; targetReps: string; weightIncrement: number }[] = [
  { name: 'Bench-Press', workingSets: 10, targetReps: '10', weightIncrement: 1 },
  { name: 'Lat-Pull-Downs', workingSets: 10, targetReps: '10', weightIncrement: 1 },
  { name: 'Squat', workingSets: 10, targetReps: '10', weightIncrement: 2.5 },
  { name: 'Leg-Press', workingSets: 10, targetReps: '10', weightIncrement: 2.5 },
  { name: 'AB-Wheel', workingSets: 3, targetReps: '15-20', weightIncrement: 1 },
  { name: 'Overhead-Press', workingSets: 10, targetReps: '10', weightIncrement: 1 },
  { name: 'Bicep-Curls', workingSets: 10, targetReps: '10', weightIncrement: 1 },
  { name: 'Triceps-Push-Down', workingSets: 10, targetReps: '10', weightIncrement: 1 }
];

function buildWorkingSetTargets(workingSets: number, targetReps: string): WorkingSetTarget[] {
  return Array.from({ length: workingSets }, () => ({
    id: crypto.randomUUID(),
    targetReps,
    weight: 0
  }));
}

// Builds the default GVT plan from whichever of the 8 lifts exist by name.
// Returns null if none of them do (e.g. all were deleted on an existing
// install), rather than seeding an empty default plan.
export function buildDefaultGvtPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = DEFAULT_GVT_LIFTS.map(
    ({ name, workingSets, targetReps, weightIncrement }): PlanExerciseConfig | null => {
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
        workingSetTargets: buildWorkingSetTargets(workingSets, targetReps),
        weightIncrement
      };
    }
  ).filter((config): config is PlanExerciseConfig => !!config);

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_GVT_PLAN_ID,
    name: 'German Volume Training (GVT)',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    oneExercisePerSession: true,
    isDefault: true
  };
}
