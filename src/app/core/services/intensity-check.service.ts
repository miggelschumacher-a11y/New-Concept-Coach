import { Injectable, inject } from '@angular/core';
import { getRecommendedIntensityRange } from '../utils/training-intensity.util';
import { TrainingGoal } from '../models/training-intensity.model';
import { IntensityWarning } from '../models/training-intensity.model';
import { UserProfileService } from './user-profile.service'; // liefert Alter/Geburtsdatum

@Injectable({ providedIn: 'root' })
export class IntensityCheckService {
  private userProfileService = inject(UserProfileService);

  checkSetIntensity(
    targetPercent1RM: number,
    goal: TrainingGoal
  ): IntensityWarning | null {
    const age = this.userProfileService.getCurrentAge();
    const recommended = getRecommendedIntensityRange(age, goal);

    if (targetPercent1RM > recommended.maxPercent) {
      const severity = targetPercent1RM > recommended.maxPercent + 10
        ? 'critical'
        : 'warning';

      return {
        severity,
        messageKey: 'intensity.warning.exceedsRecommended',
        recommendedRange: recommended,
      };
    }

    if (targetPercent1RM < recommended.minPercent) {
      return {
        severity: 'info',
        messageKey: 'intensity.info.belowRecommended',
        recommendedRange: recommended,
      };
    }

    return null;
  }
}
