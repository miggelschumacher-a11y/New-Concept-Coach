import { PlanExerciseType, IncrementScheme } from './training-plan.model';

export type SetType = 'warmup' | 'working' | 'cooldown';

export interface ExerciseSet {
  id: string;
  reps: number;
  weight: number;
  type: SetType;
  done?: boolean;
  // The prescribed rep count this set was generated with, if any (from a
  // progression scheme or a plan's target range). Kept alongside `reps` so
  // editing the achieved reps doesn't lose what was actually required to
  // judge the set a success.
  targetReps?: number;
  // Set when the plan's target was actually a from-to range (e.g. '8-12') -
  // targetReps holds the lower bound, this the upper bound.
  targetRepsMax?: number;
  // True for a tier-line scheme's AMRAP top set (as-many-reps-as-possible).
  isAmrap?: boolean;
  // Set only for a Percentage-Based exercise's set - the %1RM this set was
  // prescribed at. Lets an un-done set's displayed weight be recomputed
  // from the exercise's CURRENT 1RM (see SessionsComponent.fieldBuffer)
  // instead of staying frozen at whatever the 1RM was back when the session
  // was generated.
  percentage?: number;
  // Only meaningful for a Time-Based exercise's set - a held/timed duration
  // in seconds (0-99999) instead of reps/weight.
  seconds?: number;
}

export interface SessionExercise {
  exerciseId: string;
  sets: ExerciseSet[];
  countWarmupSets: boolean;
  countCooldownSets: boolean;
  // Optional and treated as true when absent, so sessions saved before this
  // field existed keep showing their warmup/cooldown panels unchanged.
  showWarmupSets?: boolean;
  showCooldownSets?: boolean;
  // Session-local snapshot of the plan exercise's type/scheme at the time
  // the session was generated - editable from within the session itself
  // without touching the source training plan. Purely informational: it
  // doesn't regenerate this session's already-built sets or wire up any
  // auto-progression tracking.
  exerciseType?: PlanExerciseType;
  incrementScheme?: IncrementScheme;
  minReps?: number;
  minWeight?: number;
  // Auto-deload safety net for manual (no trainingPlanId) sessions, same
  // concept as PlanExerciseConfig's fields of the same name - see
  // SessionsComponent.consecutiveExerciseFailures/applyManualDeload.
  deloadAfterFailures?: number;
  // Whether deloadPercent above is an absolute weight amount or a
  // percentage - unset is treated as 'WEIGHT' (the default), same
  // dual-purpose convention as CustomSessionExercise's own field.
  deloadType?: 'WEIGHT' | 'PERCENT';
  deloadPercent?: number;
  // Session-local snapshot of the plan exercise's weightIncrement, same
  // mirroring as exerciseType/incrementScheme above - purely informational,
  // doesn't feed a plan session's own live weight calculation (see
  // SessionsComponent.buildSessionFromPlan), which always reads the source
  // plan's config directly.
  weightIncrement?: number;
}

export interface TrainingSession {
  id: string;
  name: string;
  date: string;
  trainingPlanId?: string;
  planSessionId?: string;
  sequence?: number;
  exercises: SessionExercise[];
  notes?: string;
  timerElapsedMs: number;
  timerRunning: boolean;
  timerStartedAt?: string;
  // Set once, the first time the session's timer is started - unlike
  // timerStartedAt, this never resets on pause/resume. This is the date the
  // session's body weight lookup corresponds to.
  startedAt?: string;
  finished: boolean;
}
