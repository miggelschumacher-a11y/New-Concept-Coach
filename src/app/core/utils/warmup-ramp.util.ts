import { WarmupRampStep } from '../models/exercise.model';
import { WorkingSetTarget } from '../models/training-plan.model';
import { WeightUnit } from '../services/settings.service';

// The smallest weight increment this app ever prescribes/rounds to - one
// plate pair's worth (2.5 KG or 5 lbs.), same convention as
// SessionsComponent.roundToWeightIncrement / TrainingPlansComponent's own
// percentage-based weight preview.
function roundToWeightIncrement(weight: number, weightUnit: WeightUnit): number {
  const increment = weightUnit === 'lbs' ? 5 : 2.5;
  return Math.round(weight / increment) * increment;
}

// Turns an exercise's percentage ramp into literal warm-up set targets
// scaled off the session's actual working weight (the first working set's
// weight, after any progression/deload already applied) - e.g. a 40/60/80%
// ramp against a 100 KG working weight becomes 40/60/80 KG, each rounded to
// the nearest loadable plate increment.
export function calculateWarmupSets(workingWeight: number, ramp: WarmupRampStep[], weightUnit: WeightUnit): WorkingSetTarget[] {
  return ramp.map((step) => ({
    id: crypto.randomUUID(),
    targetReps: String(step.reps),
    weight: Math.max(0, roundToWeightIncrement((workingWeight * step.percentage) / 100, weightUnit))
  }));
}
