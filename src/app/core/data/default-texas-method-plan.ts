import { PlanDayGroup, PlanExerciseConfig, TrainingPlan, WorkingSetTarget } from '../models/training-plan.model';

// Fixed id (not a random UUID) so the seed is idempotent to re-check and the
// plan is unambiguously identifiable as THE default Texas Method plan across
// installs.
export const DEFAULT_TEXAS_METHOD_PLAN_ID = 'default-plan-texas-method';

// Fixed (not random) day-group ids - the default plan is unconditionally
// rebuilt on every load (see TrainingPlansService.ensureDefaultPlans), so a
// random id here would mint a new one every time, orphaning any already-
// generated session's own dayGroupId (same class of bug avoided already for
// BBB/Triumvirate's own day groups).
const DEFAULT_TEXAS_METHOD_VOLUME_DAY_ID = `${DEFAULT_TEXAS_METHOD_PLAN_ID}-volume`;
const DEFAULT_TEXAS_METHOD_RECOVERY_DAY_ID = `${DEFAULT_TEXAS_METHOD_PLAN_ID}-recovery`;
const DEFAULT_TEXAS_METHOD_INTENSITY_DAY_ID = `${DEFAULT_TEXAS_METHOD_PLAN_ID}-intensity`;

// The Texas Method (Mark Rippetoe / Glenn Pendlay): a 3-day weekly wave
// cycling between a high-volume day, a light recovery day, and a
// low-volume high-intensity day - unlike the 5/3/1 family, there's no
// %1RM here, just a manual "increase the weight weekly as long as form
// holds" convention (same "starts at 0" convention as every other manual
// WEIGHT_BASED plan here). Squat trains all 3 days at a different set
// count each time (5x5 volume, 2x5 recovery, 1x5 intensity) and Bench
// Press trains twice (5x5 volume, 1x5 intensity) - both use
// PlanDayGroup.exerciseOverrides so the same exercise can carry a
// different working-set list per day instead of one fixed plan-wide
// config.
function buildWorkingSetTargets(workingSets: number, targetReps: string): WorkingSetTarget[] {
  return Array.from({ length: workingSets }, () => ({ id: crypto.randomUUID(), targetReps, weight: 0 }));
}

function buildExerciseConfig(exerciseId: string, workingSets: number, targetReps: string, weightIncrement: number): PlanExerciseConfig {
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

// Builds the default Texas Method plan from whichever of its 6 lifts exist
// by name - a day is only included for the lifts that exist; if Squat
// itself is missing, its per-day overrides on the other days are dropped
// too (there's nothing to override). Returns null if none of the 6 lifts
// exist, rather than seeding an empty default plan.
export function buildDefaultTexasMethodPlan(exerciseIdByName: ReadonlyMap<string, string>): TrainingPlan | null {
  const squatId = exerciseIdByName.get('Squat');
  const benchId = exerciseIdByName.get('Bench-Press');
  const legPressId = exerciseIdByName.get('Leg-Press');
  const overheadPressId = exerciseIdByName.get('Overhead-Press');
  const barbellRowId = exerciseIdByName.get('Barbell-Row');
  const deadliftId = exerciseIdByName.get('Deadlift');

  const exerciseConfigs: PlanExerciseConfig[] = [];
  const dayGroups: PlanDayGroup[] = [];

  // Day 1: Volumentag - squat and bench's own shared config is this day's
  // 5x5 (the other days override it), leg press is its own single config.
  if (squatId || benchId || legPressId) {
    const volumeExerciseIds: string[] = [];
    if (squatId) {
      exerciseConfigs.push(buildExerciseConfig(squatId, 5, '5', 2.5));
      volumeExerciseIds.push(squatId);
    }
    if (benchId) {
      exerciseConfigs.push(buildExerciseConfig(benchId, 5, '5', 1));
      volumeExerciseIds.push(benchId);
    }
    if (legPressId) {
      exerciseConfigs.push(buildExerciseConfig(legPressId, 3, '8-10', 2.5));
      volumeExerciseIds.push(legPressId);
    }
    dayGroups.push({ id: DEFAULT_TEXAS_METHOD_VOLUME_DAY_ID, name: 'Volumentag', order: 0, exerciseIds: volumeExerciseIds });
  }

  // Day 2: Erholungstag - squat (lighter, 2x5) and bench are overridden;
  // overhead press and barbell row are their own single configs.
  if (squatId || overheadPressId || barbellRowId) {
    const recoveryExerciseIds: string[] = [];
    const recoveryOverrides: Record<string, { workingSets: number; targetReps: string }> = {};
    if (squatId) {
      recoveryExerciseIds.push(squatId);
      recoveryOverrides[squatId] = { workingSets: 2, targetReps: '5' };
    }
    if (overheadPressId) {
      exerciseConfigs.push(buildExerciseConfig(overheadPressId, 3, '5', 1));
      recoveryExerciseIds.push(overheadPressId);
    }
    if (barbellRowId) {
      exerciseConfigs.push(buildExerciseConfig(barbellRowId, 3, '10-12', 1));
      recoveryExerciseIds.push(barbellRowId);
    }
    dayGroups.push({
      id: DEFAULT_TEXAS_METHOD_RECOVERY_DAY_ID,
      name: 'Erholungstag',
      order: 1,
      exerciseIds: recoveryExerciseIds,
      exerciseOverrides: Object.keys(recoveryOverrides).length > 0 ? recoveryOverrides : undefined
    });
  }

  // Day 3: Intensitätstag - squat and bench (both 1x5, heavy) are
  // overridden; deadlift is its own single config (its only appearance in
  // the week).
  if (squatId || benchId || deadliftId) {
    const intensityExerciseIds: string[] = [];
    const intensityOverrides: Record<string, { workingSets: number; targetReps: string }> = {};
    if (squatId) {
      intensityExerciseIds.push(squatId);
      intensityOverrides[squatId] = { workingSets: 1, targetReps: '5' };
    }
    if (benchId) {
      intensityExerciseIds.push(benchId);
      intensityOverrides[benchId] = { workingSets: 1, targetReps: '5' };
    }
    if (deadliftId) {
      exerciseConfigs.push(buildExerciseConfig(deadliftId, 1, '5', 2.5));
      intensityExerciseIds.push(deadliftId);
    }
    dayGroups.push({
      id: DEFAULT_TEXAS_METHOD_INTENSITY_DAY_ID,
      name: 'Intensitätstag',
      order: 2,
      exerciseIds: intensityExerciseIds,
      exerciseOverrides: Object.keys(intensityOverrides).length > 0 ? intensityOverrides : undefined
    });
  }

  if (exerciseConfigs.length === 0) {
    return null;
  }
  return {
    id: DEFAULT_TEXAS_METHOD_PLAN_ID,
    // Attributed by name - a widely-taught, generic periodization method
    // most closely associated with Mark Rippetoe and Glenn Pendlay, same
    // uncontroversial category as the other named-but-freely-usable
    // methodologies already in this app (GZCLP, GreySkull, HST, ...).
    name: 'Texas Method (Rippetoe / Pendlay)',
    exerciseIds: exerciseConfigs.map((config) => config.exerciseId),
    exerciseConfigs,
    dayGroups,
    isDefault: true
  };
}
