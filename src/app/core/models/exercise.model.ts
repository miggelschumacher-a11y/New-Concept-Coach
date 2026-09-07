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
