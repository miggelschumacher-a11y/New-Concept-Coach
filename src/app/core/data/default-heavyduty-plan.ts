import { PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default Heavy Duty plan across
// installs.
export const DEFAULT_HEAVYDUTY_PLAN_ID = 'default-plan-heavy-duty';

// Heavy Duty (HIT) by Mike Mentzer: a single set taken to complete muscular
// failure per exercise, infrequent brief sessions across the major compound
// lifts. Only the general principle (one all-out set, low volume) is
// implemented here in original wording — no text from Mentzer's books.
const DEFAULT_HEAVYDUTY_LIFTS = ['Squat', 'Bench-Press', 'Chin-Ups', 'Overhead-Press', 'Deadlift', 'Triceps-Push-Down'];

// Builds the default Heavy Duty plan from whichever of the 6 lifts exist by
// name. Returns null if none of them do (e.g. all were deleted on an
// existing install), rather than seeding an empty default plan.
export function buildDefaultHeavyDutyPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = DEFAULT_HEAVYDUTY_LIFTS.map((name): PlanExerciseConfig | null => {
    const exerciseId = exerciseIdByName.get(name);
    return exerciseId ? { exerciseId, exerciseType: 'WEIGHT_BASED', warmupSets: 0, workingSets: 1, cooldownSets: 0 } : null;
  }).filter((config): config is PlanExerciseConfig => !!config);

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_HEAVYDUTY_PLAN_ID,
    // Attributed by name per the user's own copyright check: HIT principles
    // are free to use, but the plan should read as "Heavy Duty nach Mike
    // Mentzer" rather than implying it's his own published routine verbatim.
    name: 'Heavy Duty (Mike Mentzer)',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    isDefault: true
  };
}
