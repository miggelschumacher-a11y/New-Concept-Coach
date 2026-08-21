import { Injectable } from '@angular/core';

export type WeightUnit = 'kg' | 'lbs';
export type DateFormat = 'dd.MM.yyyy' | 'MM/dd/yyyy';

export interface AppSettings {
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
}

const STORAGE_KEY = 'trainings-app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  dateFormat: 'dd.MM.yyyy'
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings: AppSettings = this.load();

  private load(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}
