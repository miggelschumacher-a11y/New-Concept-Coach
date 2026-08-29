import { PlanExerciseType, IncrementScheme } from './training-plan.model';

export type SetType = 'warmup' | 'working' | 'cooldown';

export interface ExerciseSet {
  id: string;
  reps: number;
  weight: number;
  type: SetType;
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
