import { ExerciseWeightCategory } from './tier-line-progression.model';

// Purely informational categorization of what an exercise is performed
// with - unset ("Keine Zuordnung"/no assignment) for anything not yet
// classified, same convention as weightCategory being optional.
export type ExerciseEquipmentType = 'BARBELL' | 'DUMBBELL' | 'MACHINE' | 'BODYWEIGHT';

// Purely informational categorization of the primary muscle group an
// exercise trains - unset ("Keine Zuordnung"/no assignment) for anything
// not yet classified, same convention as equipmentType being optional.
export type MuscleGroup =
  | 'CHEST'
  | 'BACK'
  | 'SHOULDERS'
  | 'BICEPS'
  | 'TRICEPS'
  | 'FOREARMS'
  | 'ABS'
  | 'GLUTES'
  | 'QUADRICEPS'
  | 'HAMSTRINGS'
  | 'CALVES'
  | 'NECK';

// One rung of an exercise's warm-up ramp - "reps at percentage% of the
// working weight". A plan-generated session with no warm-up sets/targets of
// its own falls back to this to auto-derive literal warm-up set targets
// from whatever weight it worked out for the exercise's first working set -
// see calculateWarmupSets (core/utils/warmup-ramp.util) and its call site in
// SessionsComponent.buildSessionFromPlan.
export interface WarmupRampStep {
  id: string;
  percentage: number;
  reps: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description?: string;
  oneRepMax?: number;
  weightCategory?: ExerciseWeightCategory;
  equipmentType?: ExerciseEquipmentType;
  muscleGroup?: MuscleGroup;
  // For an exercise whose set weight is entered per side (a dumbbell, or a
  // machine with independently loaded left/right sides) - doubles it when
  // estimating oneRepMax and on the history chart, to reflect the actual
  // total load moved by both arms. Shown for every exercise regardless of
  // equipmentType, since not every such exercise is classified as
  // DUMBBELL/MACHINE. Optional/falsy for every other exercise, same
  // convention as the other classification fields being unset by default.
  doubleWeightCounting?: boolean;
  // Optional percentage-of-working-weight warm-up ramp - see
  // WarmupRampStep above. Unset/empty for every exercise by default, same
  // convention as every other optional classification field here.
  warmupRamp?: WarmupRampStep[];
  // Same idea as warmupRamp above, but for a cooldown - same
  // WarmupRampStep shape and calculateWarmupSets calculation, just applied
  // to the cooldown sets instead.
  cooldownRamp?: WarmupRampStep[];
  // Whether this exercise should also be offered in a session/plan
  // exercise's warm-up reference picker (SessionExercise.warmupExerciseIds/
  // CustomSessionExercise.warmupExerciseIds) - in addition to remaining
  // selectable as a normal trainable exercise. Mutually exclusive with
  // onlyAsWarmupExercise below - checking one clears the other.
  useAsWarmupExercise?: boolean;
  // Whether this exercise exists ONLY to be picked as a warm-up reference -
  // excluded from every "add this exercise to a session/plan" picker
  // (it can still be picked in the warm-up reference picker itself).
  onlyAsWarmupExercise?: boolean;
  // Same idea as useAsWarmupExercise/onlyAsWarmupExercise above, for the
  // cooldown reference picker instead.
  useAsCooldownExercise?: boolean;
  onlyAsCooldownExercise?: boolean;
  // Explicit opt-out of the warm-up reference picker - three-way mutually
  // exclusive with useAsWarmupExercise/onlyAsWarmupExercise above (checking
  // any one of the three clears the other two). Currently has the same
  // observable effect as leaving all three unset (excluded from the
  // reference picker, still a normal trainable exercise) - it exists so an
  // explicit "never" decision is distinguishable from "not decided yet".
  neverAsWarmupExercise?: boolean;
  // Same idea as neverAsWarmupExercise above, for the cooldown reference
  // picker instead.
  neverAsCooldownExercise?: boolean;
  // Manually entered 1RM override for Percentage-Based progression, used
  // instead of the auto-estimated oneRepMax above when useCustomOneRepMax
  // is on - see SessionsComponent.percentageSetWeight /
  // one-rep-max.util's effectiveOneRepMax. Optional and treated as 0
  // when absent, same as a freshly added exercise's default.
  customOneRepMax?: number;
  // Optional and treated as true when absent, so exercises saved before
  // this field existed keep the same default as newly added ones.
  useCustomOneRepMax?: boolean;
  // Optional externally-sourced execution photo, filled in only for
  // exercises matched to a free/openly-licensed entry in an exercise
  // database (see ExercisesComponent) - required together whenever set.
  // Every other exercise falls back to the generic animated pictogram
  // instead, so these stay unset for most rows.
  sourceImageUrl?: string;
  sourceLicense?: string;
  sourceAttribution?: string;
  sourceUrl?: string;
}
