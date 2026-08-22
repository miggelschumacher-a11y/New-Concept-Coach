import { Injectable } from '@angular/core';

export type WeightUnit = 'kg' | 'lbs';
export type DateFormat = 'dd.MM.yyyy' | 'MM/dd/yyyy';
export type Language = 'de' | 'en' | 'es' | 'pt' | 'it' | 'nl' | 'pl' | 'ru' | 'hu';

export interface AppSettings {
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  language: Language;
  dateOfBirth?: string;
}

export const LANGUAGE_DATE_FORMATS: Record<Language, DateFormat> = {
  de: 'dd.MM.yyyy',
  en: 'MM/dd/yyyy',
  es: 'dd.MM.yyyy',
  pt: 'dd.MM.yyyy',
  it: 'dd.MM.yyyy',
  nl: 'dd.MM.yyyy',
  pl: 'dd.MM.yyyy',
  ru: 'dd.MM.yyyy',
  hu: 'dd.MM.yyyy'
};

const STORAGE_KEY = 'trainings-app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  dateFormat: 'dd.MM.yyyy',
  language: 'en'
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
