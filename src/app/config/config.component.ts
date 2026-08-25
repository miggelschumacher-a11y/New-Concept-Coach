import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  SettingsService,
  WeightUnit,
  DateFormat,
  Language,
  LANGUAGE_DATE_FORMATS
} from '../core/services/settings.service';
import { IndexedDbService } from '../core/services/indexed-db.service';
import { LANGUAGES } from '../core/services/translation.service';
import { findHeartRateMax, parseHeartRateRange } from '../core/data/heart-rate-zones';
import { TRAINING_ZONES, TrainingZone } from '../core/data/training-zones';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe
  ],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss'
})
export class ConfigComponent implements OnInit {
  readonly languages = LANGUAGES;
  readonly trainingZones = TRAINING_ZONES;
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  language: Language;
  dateOfBirth: string;
  statusMessageKey: string | null = null;
  pendingReset = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly indexedDbService: IndexedDbService
  ) {
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
    this.language = settings.language;
    this.dateOfBirth = settings.dateOfBirth ?? '';
  }

  async ngOnInit(): Promise<void> {
    await this.settingsService.whenReady();
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
    this.language = settings.language;
    this.dateOfBirth = settings.dateOfBirth ?? '';
  }

  get age(): number | null {
    if (!this.dateOfBirth) {
      return null;
    }
    const birthDate = new Date(this.dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
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

  get heartRateMax(): string | null {
    return this.age === null ? null : findHeartRateMax(this.age);
  }

  zonePercentDisplay(zone: TrainingZone): string {
    return `${zone.percentMin}–${zone.percentMax} %`;
  }

  zoneHeartRateDisplay(zone: TrainingZone): string {
    const range = this.heartRateMax === null ? null : parseHeartRateRange(this.heartRateMax);
    if (!range) {
      return '–';
    }
    const min = Math.round((range.min * zone.percentMin) / 100);
    const max = Math.round((range.max * zone.percentMax) / 100);
    return `${min}–${max}`;
  }

  async onDateOfBirthChange(): Promise<void> {
    await this.settingsService.updateSettings({ dateOfBirth: this.dateOfBirth || undefined });
  }

  async onWeightUnitChange(): Promise<void> {
    await this.settingsService.updateSettings({ weightUnit: this.weightUnit });
  }

  async onDateFormatChange(): Promise<void> {
    await this.settingsService.updateSettings({ dateFormat: this.dateFormat });
  }

  async onLanguageChange(): Promise<void> {
    this.dateFormat = LANGUAGE_DATE_FORMATS[this.language];
    await this.settingsService.updateSettings({ language: this.language, dateFormat: this.dateFormat });
  }

  async exportData(): Promise<void> {
    const data = await this.indexedDbService.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trainings-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.statusMessageKey = 'config.exportSuccess';
  }

  async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      await this.indexedDbService.importAll(data);
      this.statusMessageKey = 'config.importSuccess';
    } catch {
      this.statusMessageKey = 'config.importError';
    } finally {
      input.value = '';
    }
  }

  requestResetData(): void {
    this.pendingReset = true;
  }

  cancelResetData(): void {
    this.pendingReset = false;
  }

  async confirmResetData(): Promise<void> {
    this.pendingReset = false;
    await this.indexedDbService.clearAll();
    this.statusMessageKey = 'config.resetSuccess';
  }
}
