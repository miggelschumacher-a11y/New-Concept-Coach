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
  // The prescribed hold duration this set was generated with, if any -
  // Time-Based counterpart to targetReps above, entered via the exercise's
  // own "Target Seconds" quick-entry field (see SessionsComponent.
  // updateTargetSeconds) since Time-Based exercises don't currently carry a
  // prescribed duration from a training plan.
  targetSeconds?: number;
  // Which piece of equipment (a DumbbellEntry from Config > Ausrüstung >
  // Hanteln) this set is loaded on, chosen via the weight field's long-press
  // popup (see SessionsComponent.openSetEquipmentDialog) - drives the plate
  // breakdown shown there. Unset means no specific equipment was chosen.
  // Inherited from the previous set of the same exercise when a new set is
  // added (same convention as reps/weight), same as this field's convention.
  equipmentId?: string;
  // Per-set override of Exercise.doubleWeightCounting, editable from the
  // same popup - wins over the exercise's own default when set (see
  // liftedWeight's overrideDoubleWeightCounting parameter). Defaults from
  // the owning exercise's own field when a set is first created and there's
  // no previous set of the same exercise to inherit from instead.
  doubleWeightCounting?: boolean;
  // Per-set flag from the same popup: when true, the entered weight is
  // already the load on ONE side only (e.g. a single-sided landmine/loaded
  // press), so the plate breakdown must not split it across two sides -
  // see calculatePlateLoading's singleSided parameter. Inherited the same
  // way as equipmentId/doubleWeightCounting above.
  singleSidedLoading?: boolean;
  // Set only for a warmup/cooldown set added via the reference-exercise
  // "Add set" button (see SessionsComponent.addSet's referenceExerciseId
  // parameter) - the id of the OTHER exercise (from warmupExerciseIds/
  // cooldownExerciseIds) this set is actually for, distinct from the
  // exercise that owns this SessionExercise. Unset means this set belongs
  // to the owning SessionExercise itself, as every set did before this
  // field existed.
  referenceExerciseId?: string;
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
  // Whether weightIncrement above is an absolute weight amount or a
  // percentage - unset is treated as 'WEIGHT' (the default), same
  // dual-purpose convention as this exercise's own deloadType.
  incrementType?: 'WEIGHT' | 'PERCENT';
  // Other exercises picked purely as a reminder of what to warm up/cool
  // down with before/after this one - e.g. a couple of general mobility
  // drills before a main lift. Selecting an exercise here never creates
  // any sets for it (unlike the session's own exercise-select at the top,
  // which does) - these ids are only ever displayed back in this same
  // dropdown, nothing else reads them.
  warmupExerciseIds?: string[];
  cooldownExerciseIds?: string[];
}

export interface TrainingSession {
  id: string;
  name: string;
  date: string;
  trainingPlanId?: string;
  planSessionId?: string;
  // Which of the plan's dayGroups this session was generated for, if any -
  // same idea as planSessionId, but for a plain (non-tier-line) plan's named
  // multi-exercise training day (see TrainingPlan.dayGroups). Lets
  // replenishment regenerate the same day's session again with its own
  // exercises, rather than falling back to the one-exercise-per-session or
  // single-bundled-session behavior.
  dayGroupId?: string;
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
