import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { TrainingPlansService } from '../core/services/training-plans.service';
import { TrainingPlan } from '../core/models/training-plan.model';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
  selector: 'app-training-plans',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCardModule,
    TranslatePipe
  ],
  templateUrl: './training-plans.component.html',
  styleUrl: './training-plans.component.scss'
})
export class TrainingPlansComponent implements OnInit {
  plans: TrainingPlan[] = [];
  name = '';
  description = '';

  constructor(private readonly trainingPlansService: TrainingPlansService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.plans = await this.trainingPlansService.getAll();
  }

  async addPlan(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    await this.trainingPlansService.add({
      name: this.name.trim(),
      description: this.description.trim(),
      exerciseIds: []
    });
    this.name = '';
    this.description = '';
    await this.load();
  }

  async deletePlan(id: string): Promise<void> {
    await this.trainingPlansService.delete(id);
    await this.load();
  }
}
