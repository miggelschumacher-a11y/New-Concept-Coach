import { AgeGroup, AgeAdjustedIntensity, TrainingGoal, IntensityRange } from '../models/training-intensity.model';

const BASE_RANGES: Record<TrainingGoal, IntensityRange> = {
  [TrainingGoal.MAX_STRENGTH]:      { minPercent: 85, maxPercent: 100, repRangeMin: 1,  repRangeMax: 5 },
  [TrainingGoal.HYPERTROPHY]:       { minPercent: 65, maxPercent: 85,  repRangeMin: 6,  repRangeMax: 12 },
  [TrainingGoal.ENDURANCE_STRENGTH]:{ minPercent: 40, maxPercent: 65,  repRangeMin: 15, repRangeMax: 25 },
  [TrainingGoal.REHAB_BEGINNER]:    { minPercent: 30, maxPercent: 50,  repRangeMin: 15, repRangeMax: 20 },
};

// Alters-Kappungsfaktor auf die Basisrange (kein hartes Limit, sondern Skalierung)
const AGE_CAP_FACTOR: Record<AgeGroup, number> = {
  [AgeGroup.UNDER_18]: 0.70,
  [AgeGroup.ADULT_18_39]: 1.0,
  [AgeGroup.MIDDLE_40_59]: 0.90,
  [AgeGroup.SENIOR_60_69]: 0.85,
  [AgeGroup.SENIOR_70_PLUS]: 0.80,
};

export function resolveAgeGroup(age: number): AgeGroup {
  if (age < 18) return AgeGroup.UNDER_18;
  if (age < 40) return AgeGroup.ADULT_18_39;
  if (age < 60) return AgeGroup.MIDDLE_40_59;
  if (age < 70) return AgeGroup.SENIOR_60_69;
  return AgeGroup.SENIOR_70_PLUS;
}

export function getRecommendedIntensityRange(
  age: number,
  goal: TrainingGoal
): AgeAdjustedIntensity {
  const ageGroup = resolveAgeGroup(age);
  const base = BASE_RANGES[goal];
  const factor = AGE_CAP_FACTOR[ageGroup];

  return {
    ageGroup,
    minPercent: Math.round(base.minPercent * factor),
    maxPercent: Math.round(base.maxPercent * factor),
    repRangeMin: base.repRangeMin,
    repRangeMax: base.repRangeMax,
    notes: ageGroup === AgeGroup.SENIOR_60_69 || ageGroup === AgeGroup.SENIOR_70_PLUS
      ? 'intensity.notes.seniorTechnicFocus'
      : undefined,
  };
}
