import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { ExercisesService } from '../core/services/exercises.service';
import { SettingsService } from '../core/services/settings.service';
import { Exercise } from '../core/models/exercise.model';
import { ExerciseWeightCategory } from '../core/models/tier-line-progression.model';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../core/directives/select-on-focus.directive';
import { oneRepMaxOverrideChecked, oneRepMaxOverrideDisabled } from '../core/utils/one-rep-max.util';

const CUSTOM_ONE_REP_MAX_MIN = 0;
const CUSTOM_ONE_REP_MAX_MAX = 1000;

export type ExerciseAnimationKind = 'squat' | 'hinge' | 'push' | 'pull' | 'core' | 'generic';

// Keyword-matched against an exercise's name + category (DE/EN terms) to
// pick which built-in movement-pattern animation to show, since there's no
// per-exercise animation data to draw on otherwise - checked in order, first
// match wins.
const ANIMATION_KEYWORDS: { kind: ExerciseAnimationKind; keywords: string[] }[] = [
  { kind: 'squat', keywords: ['squat', 'kniebeuge', 'lunge', 'ausfallschritt', 'leg press', 'beinpresse', 'goblet'] },
  {
    kind: 'hinge',
    keywords: ['deadlift', 'kreuzheben', 'hip thrust', 'hüftheben', 'rdl', 'good morning', 'hyperextension', 'rückenstrecker']
  },
  {
    kind: 'push',
    keywords: [
      'press',
      'drücken',
      'bench',
      'bankdrücken',
      'push',
      'dip',
      'liegestütz',
      'schulterdrücken',
      'trizeps',
      'triceps',
      'fliegende',
      'fly'
    ]
  },
  {
    kind: 'pull',
    keywords: ['row', 'rudern', 'pull', 'klimmzug', 'latzug', 'curl', 'bizeps', 'biceps', 'lat pulldown', 'face pull']
  },
  { kind: 'core', keywords: ['plank', 'planke', 'rollout', 'crunch', 'sit-up', 'situp', 'bauch', 'core', 'ab-', 'abs'] }
];

@Component({
  selector: 'app-exercises',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatSelectModule,
    MatCheckboxModule,
    MatExpansionModule,
    TranslatePipe,
    SelectOnFocusDirective
  ],
  templateUrl: './exercises.component.html',
  styleUrl: './exercises.component.scss'
})
export class ExercisesComponent implements OnInit {
  exercises: Exercise[] = [];
  name = '';
  category = '';
  weightCategory: ExerciseWeightCategory | null = null;
  pendingDeleteExerciseId: string | null = null;
  // Exercise ids whose sourceImageUrl failed to load (blocked by an ad
  // blocker, offline, the source going down, ...) - falls back to the
  // built-in animated pictogram instead of a broken image.
  private readonly failedImageExerciseIds = new Set<string>();

  constructor(
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
    this.exercises = await this.exercisesService.getAll();
  }

  async addExercise(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    await this.exercisesService.add({
      name: this.name.trim(),
      category: this.category.trim(),
      weightCategory: this.weightCategory ?? undefined,
      customOneRepMax: 0,
      useCustomOneRepMax: true
    });
    this.name = '';
    this.category = '';
    this.weightCategory = null;
    await this.load();
  }

  async updateWeightCategory(exercise: Exercise): Promise<void> {
    await this.exercisesService.update(exercise);
  }

  async updateDescription(exercise: Exercise, value: string): Promise<void> {
    exercise.description = value.trim() || undefined;
    await this.exercisesService.update(exercise);
  }

  animationKind(exercise: Exercise): ExerciseAnimationKind {
    const haystack = `${exercise.name} ${exercise.category ?? ''}`.toLowerCase();
    const match = ANIMATION_KEYWORDS.find(({ keywords }) => keywords.some((keyword) => haystack.includes(keyword)));
    return match?.kind ?? 'generic';
  }

  hasWorkingSourceImage(exercise: Exercise): boolean {
    return !!exercise.sourceImageUrl && !this.failedImageExerciseIds.has(exercise.id);
  }

  onSourceImageError(exercise: Exercise): void {
    this.failedImageExerciseIds.add(exercise.id);
  }

  customOneRepMaxDisplay(exercise: Exercise): string {
    return (exercise.customOneRepMax ?? 0).toString();
  }

  // Allows up to 4 integer digits (covers the 1000 upper bound) and up to
  // 2 decimal places while typing - final clamping to [0, 1000] happens in
  // updateCustomOneRepMax on change.
  onCustomOneRepMaxFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  async updateCustomOneRepMax(exercise: Exercise, value: string): Promise<void> {
    const parsed = parseFloat(value.replace(',', '.'));
    exercise.customOneRepMax = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, CUSTOM_ONE_REP_MAX_MIN), CUSTOM_ONE_REP_MAX_MAX)
      : 0;
    await this.exercisesService.update(exercise);
  }

  // Force-unchecked and disabled whenever no custom value has been entered
  // (0) but a real estimated 1RM already exists to fall back to - see
  // oneRepMaxOverrideChecked/Disabled in one-rep-max.util.
  useCustomOneRepMaxChecked(exercise: Exercise): boolean {
    return oneRepMaxOverrideChecked(exercise);
  }

  useCustomOneRepMaxDisabled(exercise: Exercise): boolean {
    return oneRepMaxOverrideDisabled(exercise);
  }

  async updateUseCustomOneRepMax(exercise: Exercise, useCustomOneRepMax: boolean): Promise<void> {
    exercise.useCustomOneRepMax = useCustomOneRepMax;
    await this.exercisesService.update(exercise);
  }

  requestDeleteExercise(id: string): void {
    this.pendingDeleteExerciseId = id;
  }

  cancelDeleteExercise(): void {
    this.pendingDeleteExerciseId = null;
  }

  async confirmDeleteExercise(id: string): Promise<void> {
    this.pendingDeleteExerciseId = null;
    await this.deleteExercise(id);
  }

  async deleteExercise(id: string): Promise<void> {
    await this.exercisesService.delete(id);
    await this.load();
  }
}
