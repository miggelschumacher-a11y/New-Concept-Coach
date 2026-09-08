export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }
  const raw = reps === 1 ? weight : weight * (1 + reps / 30);
  return Math.round(raw * 100) / 100;
}

export interface OneRepMaxOverrideSource {
  oneRepMax?: number;
  customOneRepMax?: number;
  useCustomOneRepMax?: boolean;
}

// The custom-1RM override is force-disabled (and its checkbox unchecked)
// whenever no custom value has been entered (0) but a real estimated 1RM
// exists to fall back to - so a freshly added exercise's default of
// customOneRepMax 0 / useCustomOneRepMax true never actually zeroes out
// Percentage-Based sets for an exercise that already has training history.
export function oneRepMaxOverrideDisabled(exercise: OneRepMaxOverrideSource): boolean {
  const custom = exercise.customOneRepMax ?? 0;
  return custom === 0 && exercise.oneRepMax !== undefined && exercise.oneRepMax > 0;
}

export function oneRepMaxOverrideChecked(exercise: OneRepMaxOverrideSource): boolean {
  return oneRepMaxOverrideDisabled(exercise) ? false : (exercise.useCustomOneRepMax ?? true);
}

// The 1RM Percentage-Based progression actually calculates upcoming sets
// from - see oneRepMaxOverrideChecked/Disabled above for when the custom
// value applies vs. falls back to the estimated max.
export function effectiveOneRepMax(exercise: OneRepMaxOverrideSource): number | undefined {
  return oneRepMaxOverrideChecked(exercise) ? (exercise.customOneRepMax ?? 0) : exercise.oneRepMax;
}

export interface DoubleWeightCountingSource {
  doubleWeightCounting?: boolean;
}

// A dumbbell (or single-side-loaded machine) exercise's set weight is
// normally entered per side - doubling it here (only when "Gewicht doppelt
// zählen" is on) reflects the actual total load moved by both arms for
// oneRepMax estimation and history charts, without touching the raw per-set
// value the user actually typed in. overrideDoubleWeightCounting is a
// specific set's own choice (see ExerciseSet.doubleWeightCounting) - it wins
// over the exercise's own default when provided, since a set logged with
// e.g. a machine that has independently loaded sides might not match the
// exercise's usual equipment.
export function liftedWeight(
  exercise: DoubleWeightCountingSource,
  weight: number,
  overrideDoubleWeightCounting?: boolean
): number {
  const doubleWeightCounting = overrideDoubleWeightCounting ?? exercise.doubleWeightCounting;
  return doubleWeightCounting ? weight * 2 : weight;
}
