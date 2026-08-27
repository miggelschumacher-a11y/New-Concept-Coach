import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TrainingPlansService } from '../core/services/training-plans.service';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { TrainingPlan, TierLinePlanExercise, PlanExerciseConfig } from '../core/models/training-plan.model';
import { Exercise } from '../core/models/exercise.model';
import { GzclTier, TrainingMethodology } from '../core/models/tier-line-progression.model';
import { WEIGHT_INCREMENT_BY_EXERCISE_TYPE } from '../core/utils/tier-line-progression.util';
import { TranslatePipe } from '../core/pipes/translate.pipe';

const DEFAULT_WARMUP_SETS = 0;
const DEFAULT_WORKING_SETS = 3;
const DEFAULT_COOLDOWN_SETS = 0;
const PLAN_EXERCISE_SETS_MAX = 100;

@Component({
  selector: 'app-training-plans',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatExpansionModule,
    MatTooltipModule,
    TranslatePipe
  ],
  templateUrl: './training-plans.component.html',
  styleUrl: './training-plans.component.scss'
})
export class TrainingPlansComponent implements OnInit {
  plans: TrainingPlan[] = [];
  exercises: Exercise[] = [];
  name = '';
  description = '';
  pendingDeletePlanId: string | null = null;

  constructor(
    private readonly trainingPlansService: TrainingPlansService,
    private readonly exercisesService: ExercisesService,
    private readonly settingsService: SettingsService
  ) {}

  get weightUnitLabel(): string {
    return this.settingsService.getSettings().weightUnit.toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    [this.plans, this.exercises] = await Promise.all([
      this.trainingPlansService.getAll(),
      this.exercisesService.getAll()
    ]);
  }

  exerciseName(exerciseId: string): string {
    return this.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? '';
  }

  tierLabelKey(tier: string): string {
    return 'trainingPlans.tier' + tier.split('_')[0];
  }

  setNumbers(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  isTierLineProgressionExercise(plan: TrainingPlan, planExercise: TierLinePlanExercise): boolean {
    return plan.methodology === TrainingMethodology.TIER_LINE_PROGRESSION && !!planExercise;
  }

  tierLineWeightIncrement(exerciseId: string): number {
    const category = this.exercises.find((exercise) => exercise.id === exerciseId)?.weightCategory ?? 'UPPER_BODY';
    return WEIGHT_INCREMENT_BY_EXERCISE_TYPE[category];
  }

  setValueDisplay(planExercise: TierLinePlanExercise, setNumber: number): string {
    const isLastSet = setNumber === planExercise.sets;
    const isAmrapTier = planExercise.tier === GzclTier.T1_MAIN || planExercise.tier === GzclTier.T3_ACCESSORY;
    return isLastSet && isAmrapTier ? `${planExercise.targetReps}+` : `${planExercise.targetReps}`;
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

  requestDeletePlan(id: string): void {
    this.pendingDeletePlanId = id;
  }

  cancelDeletePlan(): void {
    this.pendingDeletePlanId = null;
  }

  async confirmDeletePlan(id: string): Promise<void> {
    this.pendingDeletePlanId = null;
    await this.trainingPlansService.delete(id);
    await this.load();
  }

  async updatePlanExercises(plan: TrainingPlan, exerciseIds: string[]): Promise<void> {
    plan.exerciseIds = exerciseIds;
    const existingByExerciseId = new Map((plan.exerciseConfigs ?? []).map((config) => [config.exerciseId, config]));
    plan.exerciseConfigs = exerciseIds.map(
      (exerciseId) =>
        existingByExerciseId.get(exerciseId) ?? {
          exerciseId,
          warmupSets: DEFAULT_WARMUP_SETS,
          workingSets: DEFAULT_WORKING_SETS,
          cooldownSets: DEFAULT_COOLDOWN_SETS
        }
    );
    await this.trainingPlansService.update(plan);
  }

  async removePlanExercise(plan: TrainingPlan, exerciseId: string): Promise<void> {
    await this.updatePlanExercises(
      plan,
      plan.exerciseIds.filter((id) => id !== exerciseId)
    );
  }

  planExerciseConfig(plan: TrainingPlan, exerciseId: string): PlanExerciseConfig {
    return (
      plan.exerciseConfigs?.find((config) => config.exerciseId === exerciseId) ?? {
        exerciseId,
        warmupSets: DEFAULT_WARMUP_SETS,
        workingSets: DEFAULT_WORKING_SETS,
        cooldownSets: DEFAULT_COOLDOWN_SETS
      }
    );
  }

  planExerciseTotalSets(plan: TrainingPlan, exerciseId: string): number {
    const config = this.planExerciseConfig(plan, exerciseId);
    return config.warmupSets + config.workingSets + config.cooldownSets;
  }

  onPlanExerciseSetsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 3);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  private clampSets(value: string): number {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), PLAN_EXERCISE_SETS_MAX) : 0;
  }

  async updatePlanExerciseWarmupSets(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const warmupSets = this.clampSets(value);
    const config = this.planExerciseConfig(plan, exerciseId);
    plan.exerciseConfigs = (plan.exerciseConfigs ?? []).map((c) =>
      c.exerciseId === exerciseId ? { ...config, warmupSets } : c
    );
    await this.trainingPlansService.update(plan);
  }

  async updatePlanExerciseWorkingSets(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const workingSets = this.clampSets(value);
    const config = this.planExerciseConfig(plan, exerciseId);
    plan.exerciseConfigs = (plan.exerciseConfigs ?? []).map((c) =>
      c.exerciseId === exerciseId ? { ...config, workingSets } : c
    );
    await this.trainingPlansService.update(plan);
  }

  async updatePlanExerciseCooldownSets(plan: TrainingPlan, exerciseId: string, value: string): Promise<void> {
    const cooldownSets = this.clampSets(value);
    const config = this.planExerciseConfig(plan, exerciseId);
    plan.exerciseConfigs = (plan.exerciseConfigs ?? []).map((c) =>
      c.exerciseId === exerciseId ? { ...config, cooldownSets } : c
    );
    await this.trainingPlansService.update(plan);
  }
}
