import { PercentageWeek, PlanDayGroup, PlanExerciseConfig, TrainingPlan, WorkingSetTarget } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default BBB plan across installs.
export const DEFAULT_BBB_PLAN_ID = 'default-plan-531-bbb';

// Fixed (not random) day-group ids - the default plan is unconditionally
// rebuilt on every load (see TrainingPlansService.ensureDefaultPlans), so a
// random id here would mint a new one every time, orphaning any already-
// generated session's own dayGroupId (same class of bug fixed once already
// for GZCLP's day templates - see default-gzclp-plan.ts's history).
const DEFAULT_BBB_UPPER_DAY_ID = `${DEFAULT_BBB_PLAN_ID}-upper`;
const DEFAULT_BBB_LOWER_DAY_ID = `${DEFAULT_BBB_PLAN_ID}-lower`;

// Boring But Big by Jim Wendler, per the user's own 2-day upper/lower spec:
// each day's main lift (Bench-Press / Squat) runs the standard 5/3/1 wave
// plus 3 sets of 10 at a flat 65% of training max (within the user's given
// 60-70% range) right after it, followed by fixed-rep assistance work at a
// self-selected weight (same "starts at 0, increase once it's stable"
// convention as every other plain WEIGHT_BASED plan here). The 65% BBB sets
// are skipped on the deload week, same treatment as the base 5/3/1 plan's
// own recovery week.
const DEFAULT_BBB_MAIN_LIFT_PERCENTAGE_WEEKS: PercentageWeek[] = [
  {
    sets: [
      { percentage: 65, reps: 5, isAmrap: false },
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 5, isAmrap: true },
      { percentage: 65, reps: 10, isAmrap: false },
      { percentage: 65, reps: 10, isAmrap: false },
      { percentage: 65, reps: 10, isAmrap: false }
    ]
  },
  {
    sets: [
      { percentage: 70, reps: 3, isAmrap: false },
      { percentage: 80, reps: 3, isAmrap: false },
      { percentage: 90, reps: 3, isAmrap: true },
      { percentage: 65, reps: 10, isAmrap: false },
      { percentage: 65, reps: 10, isAmrap: false },
      { percentage: 65, reps: 10, isAmrap: false }
    ]
  },
  {
    sets: [
      { percentage: 75, reps: 5, isAmrap: false },
      { percentage: 85, reps: 3, isAmrap: false },
      { percentage: 95, reps: 1, isAmrap: true },
      { percentage: 65, reps: 10, isAmrap: false },
      { percentage: 65, reps: 10, isAmrap: false },
      { percentage: 65, reps: 10, isAmrap: false }
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

type AssistanceLift = { name: string; targetReps: string; weightIncrement: number };

// Day 1 (Oberkörper): Bench-Press's own 5/3/1+BBB wave, then fixed-rep
// upper-body assistance.
const DEFAULT_BBB_UPPER_ASSISTANCE: AssistanceLift[] = [
  { name: 'Overhead-Press', targetReps: '10', weightIncrement: 1 },
  { name: 'Barbell-Row', targetReps: '10', weightIncrement: 1 },
  { name: 'Triceps-Push-Down', targetReps: '10-15', weightIncrement: 1 },
  { name: 'Bicep-Curls', targetReps: '10-15', weightIncrement: 1 }
];

// Day 2 (Unterkörper): Squat's own 5/3/1+BBB wave, then fixed-rep
// lower-body assistance.
const DEFAULT_BBB_LOWER_ASSISTANCE: AssistanceLift[] = [
  { name: 'Deadlift', targetReps: '10', weightIncrement: 2.5 },
  { name: 'Leg-Press', targetReps: '10', weightIncrement: 2.5 },
  { name: 'Calf-Raises', targetReps: '15-20', weightIncrement: 2.5 },
  { name: 'AB-Wheel', targetReps: '15-20', weightIncrement: 1 }
];

function buildAssistanceTargets(targetReps: string): WorkingSetTarget[] {
  return Array.from({ length: 3 }, () => ({ id: crypto.randomUUID(), targetReps, weight: 0 }));
}

function buildMainLiftConfig(exerciseId: string): PlanExerciseConfig {
  return {
    exerciseId,
    exerciseType: 'PERCENTAGE_BASED',
    warmupSets: 0,
    workingSets: 6,
    cooldownSets: 0,
    percentageWeeks: DEFAULT_BBB_MAIN_LIFT_PERCENTAGE_WEEKS.map((week) => ({ sets: week.sets.map((set) => ({ ...set })) }))
  };
}

function buildAssistanceConfig(exerciseId: string, lift: AssistanceLift): PlanExerciseConfig {
  return {
    exerciseId,
    exerciseType: 'WEIGHT_BASED',
    warmupSets: 0,
    workingSets: 3,
    cooldownSets: 0,
    workingSetTargets: buildAssistanceTargets(lift.targetReps),
    weightIncrement: lift.weightIncrement
  };
}

// Builds the default BBB plan from whichever of the 10 lifts exist by name -
// each of the 2 main lifts (Bench-Press, Squat) is required for the day it
// anchors to be included at all; that day's assistance lifts are added
// individually, whichever of them exist. Returns null if neither main lift
// exists, rather than seeding an assistance-only default plan.
export function buildDefaultBbbPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const exerciseConfigs: PlanExerciseConfig[] = [];
  const dayGroups: PlanDayGroup[] = [];

  const benchId = exerciseIdByName.get('Bench-Press');
  if (benchId) {
    exerciseConfigs.push(buildMainLiftConfig(benchId));
    const upperExerciseIds = [benchId];
    for (const lift of DEFAULT_BBB_UPPER_ASSISTANCE) {
      const exerciseId = exerciseIdByName.get(lift.name);
      if (exerciseId) {
        exerciseConfigs.push(buildAssistanceConfig(exerciseId, lift));
        upperExerciseIds.push(exerciseId);
      }
    }
    dayGroups.push({ id: DEFAULT_BBB_UPPER_DAY_ID, name: 'Oberkörper', order: 0, exerciseIds: upperExerciseIds });
  }

  const squatId = exerciseIdByName.get('Squat');
  if (squatId) {
    exerciseConfigs.push(buildMainLiftConfig(squatId));
    const lowerExerciseIds = [squatId];
    for (const lift of DEFAULT_BBB_LOWER_ASSISTANCE) {
      const exerciseId = exerciseIdByName.get(lift.name);
      if (exerciseId) {
        exerciseConfigs.push(buildAssistanceConfig(exerciseId, lift));
        lowerExerciseIds.push(exerciseId);
      }
    }
    dayGroups.push({ id: DEFAULT_BBB_LOWER_DAY_ID, name: 'Unterkörper', order: 1, exerciseIds: lowerExerciseIds });
  }

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_BBB_PLAN_ID,
    // Attributed by name per Jim Wendler's own stated terms for using 5/3/1
    // (and its named templates) in a program: free to use, but should credit
    // him, same reasoning already applied to the base 5/3/1 plan.
    name: '5/3/1 BBB (Boring But Big)',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    // Two real training days, each one session bundling all of that day's
    // exercises (Oberkörper: Bench-Press + 4 assistance lifts; Unterkörper:
    // Squat + 4 assistance lifts) - see TrainingPlan.dayGroups.
    dayGroups,
    isDefault: true
  };
}
