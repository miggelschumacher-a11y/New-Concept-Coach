export enum TrainingMethodology {
  LINEAR_PROGRESSION = 'LINEAR_PROGRESSION',
  GZCL = 'GZCL',
  TIER_LINE_PROGRESSION = 'TIER_LINE_PROGRESSION',
  FIVE_THREE_ONE = 'FIVE_THREE_ONE',
  CUSTOM = 'CUSTOM'
}

export enum TierLineStage {
  STAGE_1 = 'STAGE_1', // T1: 5x3+, T2: 3x10
  STAGE_2 = 'STAGE_2', // T1: 6x2+, T2: 3x8
  STAGE_3 = 'STAGE_3'  // T1: 10x1+, T2: 3x6
}

export enum GzclTier {
  T1_MAIN = 'T1_MAIN',
  T2_SECONDARY = 'T2_SECONDARY',
  T3_ACCESSORY = 'T3_ACCESSORY'
}

export interface TierLineSetScheme {
  sets: number;
  targetReps: number;
  isAmrapLastSet: boolean; // AMRAP nur auf letztem Satz relevant (v.a. T1)
}

export interface TierLineProgressionState {
  exerciseId: string;
  tier: GzclTier;
  stage: TierLineStage;
  currentWeight: number;      // aktuelles Arbeitsgewicht
  consecutiveFails: number;   // Fehlschläge in Folge (nicht erreichte targetReps)
  lastUpdated: Date;
}
