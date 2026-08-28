import { PercentageWeek, PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default HST plan across installs.
export const DEFAULT_HST_PLAN_ID = 'default-plan-hst';

const DEFAULT_HST_LIFT_NAMES = ['Squat', 'Bench-Press', 'Deadlift', 'Overhead-Press', 'Barbell-Row'];

// HST (Hypertrophic Specific Training) by Bryan Haycock: progressive-load
// training through 15/10/5 rep-range phases, 2 sets per exercise, no sets
// taken to failure. Modeled as 3 recurring weeks (one per rep range) rather
// than the full 6-8 week cycle with per-session increments, matching how the
// other percentage-based plans simplify their finer progression details.
// Strategic deconditioning (the planned rest between cycles) isn't something
// this app models — it's a scheduling choice the user applies themselves.
const DEFAULT_HST_PERCENTAGE_WEEKS: PercentageWeek[] = [
  { sets: [{ percentage: 65, reps: 15, isAmrap: false }, { percentage: 65, reps: 15, isAmrap: false }] },
  { sets: [{ percentage: 75, reps: 10, isAmrap: false }, { percentage: 75, reps: 10, isAmrap: false }] },
  { sets: [{ percentage: 85, reps: 5, isAmrap: false }, { percentage: 85, reps: 5, isAmrap: false }] }
];

// Builds the default HST plan from whichever of the 5 lifts exist by name.
// Returns null if none of them do (e.g. all were deleted on an existing
// install), rather than seeding an empty default plan.
export function buildDefaultHstPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseIds = DEFAULT_HST_LIFT_NAMES.map((name) => exerciseIdByName.get(name)).filter(
    (id): id is string => !!id
  );
  if (exerciseIds.length === 0) {
    return null;
  }
  const exerciseConfigs: PlanExerciseConfig[] = exerciseIds.map((exerciseId) => ({
    exerciseId,
    exerciseType: 'PERCENTAGE_BASED',
    warmupSets: 0,
    workingSets: 2,
    cooldownSets: 0,
    percentageWeeks: DEFAULT_HST_PERCENTAGE_WEEKS.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) }))
  }));
  return {
    id: DEFAULT_HST_PLAN_ID,
    // Attributed by name — the methodology is free to use commercially with
    // correct attribution, per the user's own copyright check.
    name: 'HST (Bryan Haycock)',
    exerciseIds,
    exerciseConfigs,
    isDefault: true
  };
}
