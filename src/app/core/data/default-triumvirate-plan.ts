import { PercentageWeek, PlanDayGroup, PlanExerciseConfig, TrainingPlan, WorkingSetTarget } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default Triumvirate plan across
// installs.
export const DEFAULT_TRIUMVIRATE_PLAN_ID = 'default-plan-531-triumvirate';

// Fixed (not random) day-group ids - the default plan is unconditionally
// rebuilt on every load (see TrainingPlansService.ensureDefaultPlans), so a
// random id here would mint a new one every time, orphaning any already-
// generated session's own dayGroupId (same class of bug fixed once already
// for GZCLP's day templates, and avoided again for BBB's own day groups).
const DEFAULT_TRIUMVIRATE_SQUAT_DAY_ID = `${DEFAULT_TRIUMVIRATE_PLAN_ID}-squat`;
const DEFAULT_TRIUMVIRATE_BENCH_DAY_ID = `${DEFAULT_TRIUMVIRATE_PLAN_ID}-bench`;
const DEFAULT_TRIUMVIRATE_DEADLIFT_DAY_ID = `${DEFAULT_TRIUMVIRATE_PLAN_ID}-deadlift`;
const DEFAULT_TRIUMVIRATE_PRESS_DAY_ID = `${DEFAULT_TRIUMVIRATE_PLAN_ID}-press`;

// The Triumvirate by Jim Wendler, one of the original assistance templates
// from his 5/3/1 book: the plain 5/3/1 main-lift wave (no extra volume
// attached to the main lift itself, unlike BBB), followed by exactly 2
// assistance exercises at 5 sets of 10 reps each - "triumvirate" for the 3
// total movements trained that day. One day per main lift, same 4-lift split
// as the base 5/3/1 plan.
const DEFAULT_TRIUMVIRATE_MAIN_LIFT_PERCENTAGE_WEEKS: PercentageWeek[] = [
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

type DayLift = { mainLiftName: string; dayId: string; dayName: string; assistance: { name: string; weightIncrement: number }[] };

// Classic pairing: each day trains one main lift plus 2 unrelated assistance
// movements, 5x10 each, at a self-chosen weight (same "starts at 0, increase
// once it's stable" convention as every other plain WEIGHT_BASED plan here).
const DEFAULT_TRIUMVIRATE_DAYS: DayLift[] = [
  {
    mainLiftName: 'Squat',
    dayId: DEFAULT_TRIUMVIRATE_SQUAT_DAY_ID,
    dayName: 'Kniebeuge-Tag',
    assistance: [
      { name: 'Leg-Press', weightIncrement: 2.5 },
      { name: 'Leg-Curls', weightIncrement: 2.5 }
    ]
  },
  {
    mainLiftName: 'Bench-Press',
    dayId: DEFAULT_TRIUMVIRATE_BENCH_DAY_ID,
    dayName: 'Bankdrücken-Tag',
    assistance: [
      { name: 'Dips', weightIncrement: 1 },
      { name: 'Chin-Ups', weightIncrement: 1 }
    ]
  },
  {
    mainLiftName: 'Deadlift',
    dayId: DEFAULT_TRIUMVIRATE_DEADLIFT_DAY_ID,
    dayName: 'Kreuzheben-Tag',
    assistance: [
      { name: 'Back-Extension', weightIncrement: 2.5 },
      { name: 'AB-Wheel', weightIncrement: 1 }
    ]
  },
  {
    mainLiftName: 'Overhead-Press',
    dayId: DEFAULT_TRIUMVIRATE_PRESS_DAY_ID,
    dayName: 'Schulterdrücken-Tag',
    assistance: [
      { name: 'Lateral-Raise', weightIncrement: 1 },
      { name: 'Triceps-Push-Down', weightIncrement: 1 }
    ]
  }
];

function buildAssistanceTargets(): WorkingSetTarget[] {
  return Array.from({ length: 5 }, () => ({ id: crypto.randomUUID(), targetReps: '10', weight: 0 }));
}

function buildMainLiftConfig(exerciseId: string): PlanExerciseConfig {
  return {
    exerciseId,
    exerciseType: 'PERCENTAGE_BASED',
    warmupSets: 0,
    workingSets: 3,
    cooldownSets: 0,
    percentageWeeks: DEFAULT_TRIUMVIRATE_MAIN_LIFT_PERCENTAGE_WEEKS.map((week) => ({
      sets: week.sets.map((set) => ({ ...set }))
    }))
  };
}

function buildAssistanceConfig(exerciseId: string, weightIncrement: number): PlanExerciseConfig {
  return {
    exerciseId,
    exerciseType: 'WEIGHT_BASED',
    warmupSets: 0,
    workingSets: 5,
    cooldownSets: 0,
    workingSetTargets: buildAssistanceTargets(),
    weightIncrement
  };
}

// Builds the default Triumvirate plan from whichever of the 4 days' lifts
// exist by name - a day is only included if its own main lift exists; its 2
// assistance lifts are added individually, whichever of them exist. Returns
// null if none of the 4 main lifts exist, rather than seeding an
// assistance-only default plan.
export function buildDefaultTriumviratePlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = [];
  const dayGroups: PlanDayGroup[] = [];

  DEFAULT_TRIUMVIRATE_DAYS.forEach((day, order) => {
    const mainLiftId = exerciseIdByName.get(day.mainLiftName);
    if (!mainLiftId) {
      return;
    }
    exerciseConfigs.push(buildMainLiftConfig(mainLiftId));
    const dayExerciseIds = [mainLiftId];
    for (const { name, weightIncrement } of day.assistance) {
      const exerciseId = exerciseIdByName.get(name);
      if (exerciseId) {
        exerciseConfigs.push(buildAssistanceConfig(exerciseId, weightIncrement));
        dayExerciseIds.push(exerciseId);
      }
    }
    dayGroups.push({ id: day.dayId, name: day.dayName, order, exerciseIds: dayExerciseIds });
  });

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_TRIUMVIRATE_PLAN_ID,
    // Attributed by name per Jim Wendler's own stated terms for using 5/3/1
    // (and its named templates) in a program: free to use, but should credit
    // him, same reasoning already applied to the base 5/3/1 plan and BBB.
    name: '5/3/1 The Triumvirate',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    // 4 real training days, each one session bundling that day's main lift
    // with its 2 assistance lifts - see TrainingPlan.dayGroups.
    dayGroups,
    isDefault: true
  };
}
