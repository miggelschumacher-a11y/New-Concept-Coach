import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import {
  SettingsService,
  WeightUnit,
  DateFormat,
  Language,
  LANGUAGE_DATE_FORMATS
} from '../core/services/settings.service';
import { IndexedDbService } from '../core/services/indexed-db.service';
import { TranslationService, LANGUAGES } from '../core/services/translation.service';
import { findHeartRateMax } from '../core/data/heart-rate-zones';
import { TRAINING_ZONES } from '../core/data/training-zones';
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
    TranslatePipe
  ],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss'
})
export class ConfigComponent {
  readonly languages = LANGUAGES;
  readonly trainingZones = TRAINING_ZONES;
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  language: Language;
  dateOfBirth: string;
  statusMessageKey: string | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly indexedDbService: IndexedDbService,
    private readonly translationService: TranslationService
  ) {
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

  onDateOfBirthChange(): void {
    this.settingsService.updateSettings({ dateOfBirth: this.dateOfBirth || undefined });
  }

  onWeightUnitChange(): void {
    this.settingsService.updateSettings({ weightUnit: this.weightUnit });
  }

  onDateFormatChange(): void {
    this.settingsService.updateSettings({ dateFormat: this.dateFormat });
  }

  onLanguageChange(): void {
    this.dateFormat = LANGUAGE_DATE_FORMATS[this.language];
    this.settingsService.updateSettings({ language: this.language, dateFormat: this.dateFormat });
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

  async resetData(): Promise<void> {
    if (!confirm(this.translationService.translate('config.resetConfirm'))) {
      return;
    }
    await this.indexedDbService.clearAll();
    this.statusMessageKey = 'config.resetSuccess';
  }
}
