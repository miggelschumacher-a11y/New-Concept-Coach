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

export interface PlanExerciseConfig {
  exerciseId: string;
  exerciseType?: PlanExerciseType;
  // Each 0-100.
  warmupSets: number;
  workingSets: number;
  cooldownSets: number;
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
