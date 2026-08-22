export enum TrainingGoal {
  MAX_STRENGTH = 'MAX_STRENGTH',       // Maximalkraft
  HYPERTROPHY = 'HYPERTROPHY',         // Kraftaufbau
  ENDURANCE_STRENGTH = 'ENDURANCE_STRENGTH', // Kraftausdauer
  REHAB_BEGINNER = 'REHAB_BEGINNER'    // Reha/Einsteiger
}

export interface IntensityRange {
  minPercent: number;   // % des 1RM
  maxPercent: number;
  repRangeMin: number;
  repRangeMax: number;
}

export interface AgeAdjustedIntensity extends IntensityRange {
  ageGroup: AgeGroup;
  notes?: string;       // z.B. Hinweis auf Regenerationszeit, Technikfokus
}

export enum AgeGroup {
  UNDER_18 = 'UNDER_18',
  ADULT_18_39 = 'ADULT_18_39',
  MIDDLE_40_59 = 'MIDDLE_40_59',
  SENIOR_60_69 = 'SENIOR_60_69',
  SENIOR_70_PLUS = 'SENIOR_70_PLUS'
}

export interface IntensityWarning {
  severity: 'info' | 'warning' | 'critical';
  messageKey: string;   // i18n-Key statt Hardcoded-Text
  recommendedRange: IntensityRange;
}
