import { ExerciseWeightCategory } from './tier-line-progression.model';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description?: string;
  oneRepMax?: number;
  weightCategory?: ExerciseWeightCategory;
}
