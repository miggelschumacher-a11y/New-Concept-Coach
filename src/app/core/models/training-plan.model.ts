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
  // Only meaningful when a working set's own target is an actual range
  // (min !== max, see WorkingSetTarget): whether reaching just the lower
  // bound is enough to trigger a weight increase (true), or whether the
  // upper bound must be reached instead (false). Applies uniformly across
  // every working set's own target.
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

export interface WorkingSetTarget {
  id: string;
  // Same text format as a session set's own target-reps field: plain
  // number ('10'), a from-to range ('8-12'), either optionally suffixed
  // with '+' for AMRAP.
  targetReps: string;
  weight: number;
}

export interface PlanExerciseConfig {
  exerciseId: string;
  exerciseType?: PlanExerciseType;
  // Only meaningful when exerciseType is WEIGHT_BASED.
  incrementScheme?: IncrementScheme;
  // Each 0-100.
  warmupSets: number;
  // Working-set count and per-set starting reps/weight for non-WEIGHT_BASED
  // exercise types (TIME_BASED). WEIGHT_BASED exercises use
  // workingSetTargets below instead - its length is their working-set count.
  workingSets: number;
  cooldownSets: number;
  // Only used when exerciseType is WEIGHT_BASED - each working set's own
  // starting target reps and weight, editable/addable/deletable like a
  // session's own set list. Its length replaces workingSets as the working
  // set count. Feeds the very first session generated (and the seed weight
  // a tracked incrementScheme's state initializes from); once a scheme's
  // own state exists, that scheme's own progression logic takes over as
  // before - see SessionsComponent.buildSessionFromPlan.
  workingSetTargets?: WorkingSetTarget[];
  // Same idea as workingSetTargets, but for the warm-up/cooldown sets -
  // WEIGHT_BASED only, no scheme/deload logic ever applies to these, just a
  // literal per-set reps/weight prescription.
  warmupSetTargets?: WorkingSetTarget[];
  cooldownSetTargets?: WorkingSetTarget[];
  // Only used when exerciseType is PERCENTAGE_BASED - a wave of weeks, each
  // with its own set-by-set %1RM/reps/AMRAP, e.g. a 5/3/1 style cycle.
  // Cycles through by position, one week per session, wrapping back to the
  // first week after the last - however many weeks there are.
  percentageWeeks?: PercentageWeek[];
  // Only used when exerciseType is PERCENTAGE_BASED - after how many days
  // this exercise is trained again within its cycle, 1-7 (defaults to 1
  // when unset). Purely informational, doesn't drive session
  // generation/scheduling itself.
  cycleDays?: number;
  // Only used when incrementScheme is DOUBLE_PROGRESSION.
  doubleProgression?: DoubleProgressionConfig;
  // Only used when incrementScheme is REP_GOAL.
  repGoal?: RepGoalConfig;
  // Only used when incrementScheme is WAVE_PROGRESSION.
  waveProgression?: WaveProgressionConfig;
  // Only used when incrementScheme is LINEAR_PROGRESSION.
  linearProgression?: LinearProgressionConfig;
  // Auto-deload safety net, independent of the incrementScheme above: once
  // this exercise's working sets have failed to meet their target reps in
  // this many consecutive finished sessions (0-1000; unset/0 disables it),
  // the next session's weight is cut by deloadPercent (0-100). Computed live
  // from session history rather than tracked as separate persisted state -
  // see SessionsComponent.consecutiveExerciseFailures/applyDeload.
  deloadAfterFailures?: number;
  deloadPercent?: number;
  // Only used when exerciseType is WEIGHT_BASED - how much weight this
  // exercise's working sets gain each time its incrementScheme records a
  // success. Unset falls back to DEFAULT_WEIGHT_INCREMENT (1).
  weightIncrement?: number;
  // Session-level defaults for a session exercise generated from this plan
  // exercise - same fields/meaning as SessionExercise's own show
  // warmup/cooldown booleans (see session.model.ts). Optional and treated
  // as true when absent.
  showWarmupSets?: boolean;
  showCooldownSets?: boolean;
}

// One exercise within a CustomPlanSession, with its own working-set list -
// same shape/editing convention as PlanExerciseConfig.workingSetTargets, but
// this one exercise only ever belongs to this one session.
export interface CustomSessionExercise {
  exerciseId: string;
  workingSetTargets: WorkingSetTarget[];
  // Same "Settings" accordion fields as PlanExerciseConfig - only meaningful
  // when the owning session's exerciseType is WEIGHT_BASED.
  incrementScheme?: IncrementScheme;
  weightIncrement?: number;
  // Auto-deload safety net, same meaning as PlanExerciseConfig's own fields.
  deloadAfterFailures?: number;
  // Whether deloadPercent below is an absolute weight amount or a percentage
  // - unset is treated as 'WEIGHT' (the default). Same value slot either
  // way, same dual-purpose convention as CustomSessionExercise's own
  // workingSetTargets weight field switching to a percentage display.
  deloadType?: 'WEIGHT' | 'PERCENT';
  deloadPercent?: number;
  // Optional and treated as true when absent, same as PlanExerciseConfig.
  showWarmupSets?: boolean;
  showCooldownSets?: boolean;
}

// One training unit within a self-created plan's "Neue Trainingseinheit"
// list - its own exercise selection, independent of every other session in
// the plan. Displayed as "Einheit N" by position (1-indexed), not a stored
// number, so it stays correct if a session is ever removed from the middle.
export interface CustomPlanSession {
  id: string;
  // Same dual-array shape as TrainingPlan's own exerciseIds/exerciseConfigs -
  // exerciseIds drives the Exercises select field directly (a stable array
  // reference, unlike a derived one recomputed every change-detection pass,
  // which caused mat-select's multi-selection to loop), exercises carries
  // each selected exercise's own working-set list, kept in sync by
  // updateCustomSessionExercises.
  exerciseIds: string[];
  exercises: CustomSessionExercise[];
  // Shown next to the Exercises select field itself.
  exerciseType?: PlanExerciseType;
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
  // Self-created (non-default) plans built via "Neue Trainingseinheit" -
  // replaces exerciseIds/exerciseConfigs above as the editable structure for
  // these plans, one entry per training session the user has added.
  customSessions?: CustomPlanSession[];
  // Only meaningful when planSessions is unset - "Create from plan" and
  // replenishment generate one session per exerciseId instead of a single
  // session bundling every exercise, e.g. 5/3/1's one-lift-per-day split.
  oneExercisePerSession?: boolean;
  isDefault?: boolean;
}
