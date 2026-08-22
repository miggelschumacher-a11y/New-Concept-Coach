import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  constructor(private readonly settingsService: SettingsService) {}

  getCurrentAge(): number {
    const dateOfBirth = this.settingsService.getSettings().dateOfBirth;
    if (!dateOfBirth) {
      return 0;
    }
    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return 0;
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!hasHadBirthdayThisYear) {
      age--;
    }
    return age;
  }
}
