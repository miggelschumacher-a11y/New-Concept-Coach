import { GzclTier, TierLineStage, TrainingMethodology } from './tier-line-progression.model';

export interface TierLinePlanExercise {
  exerciseId: string;
  tier: GzclTier;
  stage: TierLineStage;
  sets: number;
  // Plain number ('8') or a from-to range ('8-12'), each side 0-10000.
  targetReps: string;
}

export interface TierLinePlanSession {
  id: string;
  name: string;
  order: number;
  exercises: TierLinePlanExercise[];
}

export type PlanExerciseType = 'WEIGHT_BASED' | 'PERCENTAGE_BASED' | 'TIME_BASED';

export interface PercentageSet {
  // Of the exercise's current one-rep max, 0-100.
  percentage: number;
  // Target reps, 0-100.
  reps: number;
  isAmrap: boolean;
}

export interface PercentageWeek {
  sets: PercentageSet[];
}

export interface PlanExerciseConfig {
  exerciseId: string;
  exerciseType?: PlanExerciseType;
  // Each 0-100.
  warmupSets: number;
  workingSets: number;
  cooldownSets: number;
  // Only used when exerciseType is PERCENTAGE_BASED - a wave of weeks, each
  // with its own set-by-set %1RM/reps/AMRAP, e.g. a 5/3/1 style cycle.
  percentageWeeks?: PercentageWeek[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  description?: string;
  exerciseIds: string[];
  methodology?: TrainingMethodology;
  planSessions?: TierLinePlanSession[];
  // Per-exercise sets/reps config for self-created plans (no planSessions).
  // One entry per id in exerciseIds, kept in sync by updatePlanExercises.
  exerciseConfigs?: PlanExerciseConfig[];
  isDefault?: boolean;
}
