import { PercentageSet, PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default nSuns plan across installs.
export const DEFAULT_NSUNS_PLAN_ID = 'default-plan-nsuns-531';

const DEFAULT_NSUNS_LIFT_NAMES = ['Squat', 'Bench-Press', 'Deadlift', 'Overhead-Press'];

// nSuns 5/3/1 (by Reddit user nSuns): a higher-volume take on Wendler's
// 5/3/1. Unlike Wendler's plan, there's no multi-week wave — every session
// uses the same 9-set percentage scheme against the current training max, so
// this is modeled as a single recurring week rather than several.
const DEFAULT_NSUNS_SETS: PercentageSet[] = [
  { percentage: 65, reps: 8, isAmrap: false },
  { percentage: 75, reps: 6, isAmrap: false },
  { percentage: 85, reps: 4, isAmrap: false },
  { percentage: 90, reps: 2, isAmrap: false },
  { percentage: 95, reps: 1, isAmrap: false },
  { percentage: 85, reps: 3, isAmrap: false },
  { percentage: 80, reps: 5, isAmrap: false },
  { percentage: 75, reps: 6, isAmrap: false },
  { percentage: 70, reps: 8, isAmrap: true }
];

// Builds the default nSuns plan from whichever of the 4 lifts exist by name.
// Returns null if none of them do (e.g. all were deleted on an existing
// install), rather than seeding an empty default plan.
export function buildDefaultNsunsPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseIds = DEFAULT_NSUNS_LIFT_NAMES.map((name) => exerciseIdByName.get(name)).filter(
    (id): id is string => !!id
  );
  if (exerciseIds.length === 0) {
    return null;
  }
  const exerciseConfigs: PlanExerciseConfig[] = exerciseIds.map((exerciseId) => ({
    exerciseId,
    exerciseType: 'PERCENTAGE_BASED',
    warmupSets: 0,
    workingSets: 3,
    cooldownSets: 0,
    percentageWeeks: [{ sets: DEFAULT_NSUNS_SETS.map((set) => ({ ...set })) }]
  }));
  return {
    id: DEFAULT_NSUNS_PLAN_ID,
    // Attributed by handle — only the Reddit username is known, not a real
    // name, unlike the other default plans.
    name: 'nSuns 5/3/1',
    exerciseIds,
    exerciseConfigs,
    isDefault: true
  };
}
