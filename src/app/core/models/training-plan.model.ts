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

// Layered on top of a WEIGHT_BASED exercise - orthogonal to PlanExerciseType,
// not a value of it, since e.g. Percentage-Based already has its own
// progression built into %1RM and doesn't combine with these. 'NONE' means
// a plain weight-based exercise with no automatic tracking.
export type IncrementScheme = 'NONE' | 'DOUBLE_PROGRESSION' | 'REP_GOAL' | 'WAVE_PROGRESSION' | 'LINEAR_PROGRESSION';

// 'ADD_TO_ALL_SETS': every set gains a rep each session, in lockstep.
// 'ADD_ONE_TOTAL_REP': only one set gains a rep each session, distributed
// across sets round-robin, until all have caught up.
export type DoubleProgressionMode = 'ADD_TO_ALL_SETS' | 'ADD_ONE_TOTAL_REP';

export interface DoubleProgressionConfig {
  // Bottom and top of the rep range, each 1-100. Reaching upperReps on every
  // set resets all sets back to lowerReps with an increased weight.
  lowerReps: number;
  upperReps: number;
  mode: DoubleProgressionMode;
}

export interface RepGoalConfig {
  // Total reps to reach across all working sets, each pushed close to
  // failure, before the weight increases next session. 1-100.
  totalRepGoal: number;
}

export interface WaveProgressionConfig {
  // Top and bottom of the rep target for a wave, each 1-100. Every session
  // steps the rep target down by repsDecrement and the weight up by the
  // exercise's usual increment; once finalReps is reached, the next wave
  // starts back at initialReps with the weight one increment above where
  // the previous wave started.
  initialReps: number;
  finalReps: number;
  repsDecrement: number;
}

export interface LinearProgressionConfig {
  // Plain number ('5') or a from-to range ('8-12'), each side 1-100. No
  // global default - set directly per exercise.
  targetReps: string;
  // Only meaningful when targetReps is an actual range (min !== max):
  // whether every working set reaching just the lower bound is enough to
  // trigger a weight increase (true), or whether every set must reach the
  // upper bound instead (false).
  lowerBoundSufficient: boolean;
}

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
  // Only meaningful when exerciseType is WEIGHT_BASED.
  incrementScheme?: IncrementScheme;
  // Each 0-100.
  warmupSets: number;
  workingSets: number;
  cooldownSets: number;
  // Only used when exerciseType is PERCENTAGE_BASED - a wave of weeks, each
  // with its own set-by-set %1RM/reps/AMRAP, e.g. a 5/3/1 style cycle.
  percentageWeeks?: PercentageWeek[];
  // Only used when incrementScheme is DOUBLE_PROGRESSION.
  doubleProgression?: DoubleProgressionConfig;
  // Only used when incrementScheme is REP_GOAL.
  repGoal?: RepGoalConfig;
  // Only used when incrementScheme is WAVE_PROGRESSION.
  waveProgression?: WaveProgressionConfig;
  // Only used when incrementScheme is LINEAR_PROGRESSION.
  linearProgression?: LinearProgressionConfig;
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
