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
