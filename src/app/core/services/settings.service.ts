import { Injectable } from '@angular/core';
import { IndexedDbService, STORES } from './indexed-db.service';
import { DoubleProgressionMode } from '../models/training-plan.model';

export type WeightUnit = 'kg' | 'lbs';
export type DateFormat = 'dd.MM.yyyy' | 'MM/dd/yyyy';
export type Language = 'de' | 'en' | 'es' | 'pt' | 'it' | 'nl' | 'pl' | 'ru' | 'hu';
export type FinishedSessionReplenishMode = 'always' | 'never' | 'ask';
export type Theme = 'dark' | 'light';
export type AutoAdvanceMode = 'immediate' | 'confirm' | 'off';

export interface AppSettings {
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  language: Language;
  dateOfBirth?: string;
  finishedSessionReplenishMode: FinishedSessionReplenishMode;
  theme: Theme;
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
  // Default rest durations in seconds (Config page > "Pausen") - purely
  // informational settings for now, not yet read anywhere else.
  firstRestAfterSet: number;
  secondRestAfterSet: number;
  restBetweenExercises: number;
  // Whether finishing every set in a section (warm-up/working) should
  // automatically collapse that section and open the next one for the same
  // exercise, when that next section still has sets left to do (Config page
  // > "Automatisierte Trainingseinheit"). Nothing follows cooldown, so it
  // has no setting of its own.
  warmupSetsAutoAdvance: AutoAdvanceMode;
  workingSetsAutoAdvance: AutoAdvanceMode;
  // Whether the paid tier is unlocked - gates the own-training-plan count,
  // the three non-linear increment schemes, the plate calculator, and
  // Google Drive backup/restore (see each feature's own isPro check). Set
  // here directly for now via Config's own toggle; will be driven by the
  // real purchase/restore result once the native Capacitor billing
  // integration lands, at which point that toggle goes away.
  isPro: boolean;
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
  theme: 'dark',
  doubleProgressionLowerReps: 8,
  doubleProgressionUpperReps: 10,
  doubleProgressionMode: 'ADD_TO_ALL_SETS',
  repGoalTotalRepGoal: 25,
  waveProgressionInitialReps: 8,
  waveProgressionFinalReps: 6,
  waveProgressionRepsDecrement: 1,
  firstRestAfterSet: 60,
  secondRestAfterSet: 60,
  restBetweenExercises: 180,
  warmupSetsAutoAdvance: 'confirm',
  workingSetsAutoAdvance: 'confirm',
  isPro: false
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
