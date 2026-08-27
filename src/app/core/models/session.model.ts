export type SetType = 'warmup' | 'working' | 'cooldown';

export interface ExerciseSet {
  id: string;
  // Plain number ('8') or a from-to range ('8-12'), each side 0-10000.
  reps: string;
  weight: number;
  type: SetType;
}

export interface SessionExercise {
  exerciseId: string;
  sets: ExerciseSet[];
  countWarmupSets: boolean;
  countCooldownSets: boolean;
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
  finished: boolean;
}
