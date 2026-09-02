import { ExerciseWeightCategory } from './tier-line-progression.model';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description?: string;
  oneRepMax?: number;
  weightCategory?: ExerciseWeightCategory;
  // Manually entered 1RM override for Percentage-Based progression, used
  // instead of the auto-estimated oneRepMax above when useCustomOneRepMax
  // is on - see SessionsComponent.percentageSetWeight /
  // TrainingPlansComponent.percentageSetWeight. Optional and treated as 0
  // when absent, same as a freshly added exercise's default.
  customOneRepMax?: number;
  // Optional and treated as true when absent, so exercises saved before
  // this field existed keep the same default as newly added ones.
  useCustomOneRepMax?: boolean;
}
