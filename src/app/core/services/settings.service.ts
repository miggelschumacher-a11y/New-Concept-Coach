import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { DoubleProgressionMode } from '../models/training-plan.model';

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
  // Default Double Progression increment scheme (Config page). Copied into a
  // plan exercise's own config the first time it's switched to
  // DOUBLE_PROGRESSION, then editable per exercise from there on.
  doubleProgressionLowerReps: number;
  doubleProgressionUpperReps: number;
  doubleProgressionMode: DoubleProgressionMode;
  // Default Rep Goal System total (Config page). Copied into a plan
  // exercise's own config the first time it's switched to REP_GOAL, then
  // editable per exercise from there on.
  repGoalTotalRepGoal: number;
  // Default Wave Progression rep range/decrement (Config page). Copied into
  // a plan exercise's own config the first time it's switched to
  // WAVE_PROGRESSION, then editable per exercise from there on.
  waveProgressionInitialReps: number;
  waveProgressionFinalReps: number;
  waveProgressionRepsDecrement: number;
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
  finishedSessionReplenishMode: 'always',
  doubleProgressionLowerReps: 8,
  doubleProgressionUpperReps: 10,
  doubleProgressionMode: 'ADD_TO_ALL_SETS',
  repGoalTotalRepGoal: 25,
  waveProgressionInitialReps: 8,
  waveProgressionFinalReps: 6,
  waveProgressionRepsDecrement: 1
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
