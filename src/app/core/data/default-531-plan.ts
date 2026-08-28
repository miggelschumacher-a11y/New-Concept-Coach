import { PercentageWeek, PlanExerciseConfig, TrainingPlan } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default 5/3/1 plan across installs.
export const DEFAULT_531_PLAN_ID = 'default-plan-531-powerlifting';

const DEFAULT_531_LIFT_NAMES = ['Squat', 'Bench-Press', 'Deadlift', 'Overhead-Press'];

// Classic Wendler 5/3/1: 3 waves building to a heavier AMRAP top set, then a
// deload week.
const DEFAULT_531_PERCENTAGE_WEEKS: PercentageWeek[] = [
  {
    sets: [
      { percentage: 65, reps: 5, isAmrap: false },
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 5, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 70, reps: 3, isAmrap: false },
      { percentage: 80, reps: 3, isAmrap: false },
      { percentage: 90, reps: 3, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 3, isAmrap: false },
      { percentage: 95, reps: 1, isAmrap: true }
    ]
  },
  {
    sets: [
      { percentage: 40, reps: 5, isAmrap: false },
      { percentage: 50, reps: 5, isAmrap: false },
      { percentage: 60, reps: 5, isAmrap: false }
    ]
  }
];

const DEFAULT_531_PLAN_DESCRIPTION =
  'Klassisches Wendler 5/3/1: 4-Wochen-Zyklus (3 Aufbauwochen + Deload-Woche) für Squat, ' +
  'Bankdrücken, Kreuzheben und Overhead-Press, basierend auf Prozentsätzen des 1RM.';

// Builds the default 5/3/1 plan from whichever of the 4 lifts exist by name.
// Returns null if none of them do (e.g. all were deleted on an existing
// install), rather than seeding an empty default plan.
export function buildDefault531Plan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseIds = DEFAULT_531_LIFT_NAMES.map((name) => exerciseIdByName.get(name)).filter(
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
    percentageWeeks: DEFAULT_531_PERCENTAGE_WEEKS.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) }))
  }));
  return {
    id: DEFAULT_531_PLAN_ID,
    name: '5/3/1 Powerlifting',
    description: DEFAULT_531_PLAN_DESCRIPTION,
    exerciseIds,
    exerciseConfigs,
    isDefault: true
  };
}
