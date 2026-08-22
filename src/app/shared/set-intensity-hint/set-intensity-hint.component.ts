import { Component, computed, inject, input } from '@angular/core';
import { IntensityCheckService } from '../../core/services/intensity-check.service';
import { TrainingGoal, IntensityWarning } from '../../core/models/training-intensity.model';
import { TranslatePipe } from '../../core/pipes/translate.pipe';

@Component({
  selector: 'app-set-intensity-hint',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (warning(); as warning) {
      <p class="intensity-hint" [class]="'severity-' + warning.severity">
        {{ warning.messageKey | translate }}
        ({{ warning.recommendedRange.minPercent }}–{{ warning.recommendedRange.maxPercent }}{{
          'intensity.recommendedSuffix' | translate
        }})
      </p>
    }
  `,
  styleUrl: './set-intensity-hint.component.scss'
})
export class SetIntensityHintComponent {
  private readonly intensityCheck = inject(IntensityCheckService);

  targetPercent1RM = input.required<number>();
  goal = input.required<TrainingGoal>();

  warning = computed<IntensityWarning | null>(() =>
    this.intensityCheck.checkSetIntensity(this.targetPercent1RM(), this.goal())
  );
}
