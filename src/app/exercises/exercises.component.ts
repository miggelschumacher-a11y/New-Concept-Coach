import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExercisesService } from '../core/services/exercises.service';
import { Exercise } from '../core/models/exercise.model';

@Component({
  selector: 'app-exercises',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './exercises.component.html',
  styleUrl: './exercises.component.scss'
})
export class ExercisesComponent implements OnInit {
  exercises: Exercise[] = [];
  name = '';
  category = '';

  constructor(private readonly exercisesService: ExercisesService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.exercises = await this.exercisesService.getAll();
  }

  async addExercise(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    await this.exercisesService.add({ name: this.name.trim(), category: this.category.trim() });
    this.name = '';
    this.category = '';
    await this.load();
  }

  async deleteExercise(id: string): Promise<void> {
    await this.exercisesService.delete(id);
    await this.load();
  }
}
