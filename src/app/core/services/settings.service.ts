import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';

export type WeightUnit = 'kg' | 'lbs';
export type DateFormat = 'dd.MM.yyyy' | 'MM/dd/yyyy';
export type Language = 'de' | 'en' | 'es' | 'pt' | 'it' | 'nl' | 'pl' | 'ru' | 'hu';
export type FinishedSessionReplenishMode = 'always' | 'never' | 'ask';

export interface AppSettings {
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  language: Language;
  dateOfBirth?: string;
  finishedSessionReplenishMode: FinishedSessionReplenishMode;
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

const LEGACY_STORAGE_KEY = 'trainings-app-settings';
const SETTINGS_RECORD_ID = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  dateFormat: 'dd.MM.yyyy',
  language: 'en',
  finishedSessionReplenishMode: 'always'
};

type SettingsRecord = AppSettings & { id: string };

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private readonly ready: Promise<void>;

  constructor(private readonly db: IndexedDbService) {
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const stored = await this.db.get<SettingsRecord>(STORES.settings, SETTINGS_RECORD_ID);
    if (stored) {
      const { id: _id, ...settings } = stored;
      this.settings = { ...DEFAULT_SETTINGS, ...settings };
      return;
    }

    const migrated = this.readLegacySettings();
    if (migrated) {
      this.settings = migrated;
      await this.persist();
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  private readLegacySettings(): AppSettings | null {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return null;
    }
  }

  private async persist(): Promise<void> {
    await this.db.put<SettingsRecord>(STORES.settings, { id: SETTINGS_RECORD_ID, ...this.settings });
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  getSettings(): AppSettings {
    return this.settings;
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.persist();
  }
}
