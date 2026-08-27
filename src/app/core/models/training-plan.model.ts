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

export interface TrainingPlan {
  id: string;
  name: string;
  description?: string;
  exerciseIds: string[];
  methodology?: TrainingMethodology;
  planSessions?: TierLinePlanSession[];
  isDefault?: boolean;
}
