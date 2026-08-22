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
}

export interface TrainingSession {
  id: string;
  date: string;
  trainingPlanId?: string;
  exercises: SessionExercise[];
  notes?: string;
}
