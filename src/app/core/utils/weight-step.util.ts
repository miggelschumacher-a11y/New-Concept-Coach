import { Exercise } from '../models/exercise.model';

export const DEFAULT_UPPER_BODY_WEIGHT_STEP = 2.5;
export const DEFAULT_LOWER_BODY_WEIGHT_STEP = 5;

// What an exercise's weight step starts out as: 2.5 for upper-body exercises
// (also those with no body region set, which count as upper body everywhere
// else too) and 5 for lower-body ones.
export function defaultWeightStep(exercise: Pick<Exercise, 'weightCategory'> | undefined): number {
  return exercise?.weightCategory === 'LOWER_BODY' ? DEFAULT_LOWER_BODY_WEIGHT_STEP : DEFAULT_UPPER_BODY_WEIGHT_STEP;
}

// The step the minus/plus buttons of a set's weight fields use for this
// exercise: the one entered in the exercise's master data, else its default.
export function exerciseWeightStep(exercise: Pick<Exercise, 'weightCategory' | 'weightStep'> | undefined): number {
  const step = exercise?.weightStep;
  return step !== undefined && step > 0 ? step : defaultWeightStep(exercise);
}
