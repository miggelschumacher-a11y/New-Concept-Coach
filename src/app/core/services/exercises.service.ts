import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { Exercise } from '../models/exercise.model';

@Injectable({ providedIn: 'root' })
export class ExercisesService {
  constructor(private readonly db: IndexedDbService) {}

  async getAll(): Promise<Exercise[]> {
    const exercises = await this.db.getAll<Exercise>(STORES.exercises);
    return exercises.sort((a, b) => a.name.localeCompare(b.name));
  }

  add(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    const newExercise: Exercise = { ...exercise, id: crypto.randomUUID() };
    return this.db.add(STORES.exercises, newExercise).then(() => newExercise);
  }

  update(exercise: Exercise): Promise<void> {
    return this.db.put(STORES.exercises, exercise);
  }

  delete(id: string): Promise<void> {
    return this.db.delete(STORES.exercises, id);
  }
}
