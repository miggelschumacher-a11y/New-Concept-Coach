import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
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
  LANGUAGE_DATE_FORMATS,
  FinishedSessionReplenishMode
} from '../core/services/settings.service';
import { IndexedDbService, STORES } from '../core/services/indexed-db.service';
import { DriveBackupFile, GoogleDriveService } from '../core/services/google-drive.service';
import { LANGUAGES } from '../core/services/translation.service';
import { findHeartRateMax, parseHeartRateRange } from '../core/data/heart-rate-zones';
import { TRAINING_ZONES, TrainingZone } from '../core/data/training-zones';
import { BodyWeightEntry } from '../core/models/body-weight-entry.model';
import { TranslatePipe } from '../core/pipes/translate.pipe';

const BODY_WEIGHT_MAX = 300;

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
    DatePipe,
    DecimalPipe,
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
  finishedSessionReplenishMode: FinishedSessionReplenishMode;
  statusMessageKey: string | null = null;
  pendingDriveBackupJson: string | null = null;
  driveFileName = '';
  pendingDriveRestoreFiles: DriveBackupFile[] | null = null;
  bodyWeightEntries: BodyWeightEntry[] = [];
  newBodyWeightValue = '';
  newBodyWeightTimestamp = this.currentLocalDateTime();
  pendingDeleteBodyWeightId: string | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly indexedDbService: IndexedDbService,
    private readonly googleDriveService: GoogleDriveService
  ) {
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
    this.language = settings.language;
    this.dateOfBirth = settings.dateOfBirth ?? '';
    this.finishedSessionReplenishMode = settings.finishedSessionReplenishMode;
  }

  async ngOnInit(): Promise<void> {
    await this.settingsService.whenReady();
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
    this.language = settings.language;
    this.dateOfBirth = settings.dateOfBirth ?? '';
    this.finishedSessionReplenishMode = settings.finishedSessionReplenishMode;
    this.bodyWeightEntries = await this.indexedDbService.getAll<BodyWeightEntry>(STORES.bodyWeightEntries);
  }

  private currentLocalDateTime(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
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

  get weightUnitLabel(): string {
    return this.weightUnit.toUpperCase();
  }

  get timestampDisplayFormat(): string {
    return `${this.dateFormat}, HH:mm`;
  }

  get sortedBodyWeightEntries(): BodyWeightEntry[] {
    return [...this.bodyWeightEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
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

  async onFinishedSessionReplenishModeChange(): Promise<void> {
    await this.settingsService.updateSettings({ finishedSessionReplenishMode: this.finishedSessionReplenishMode });
  }

  async startDriveBackup(): Promise<void> {
    const data = await this.indexedDbService.exportAll();
    this.driveFileName = `trainings-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
    this.pendingDriveBackupJson = JSON.stringify(data, null, 2);
  }

  cancelDriveBackup(): void {
    this.pendingDriveBackupJson = null;
  }

  async confirmDriveBackup(): Promise<void> {
    // Requested directly inside this click handler, still tied to the user
    // gesture, so the Google sign-in popup doesn't get blocked.
    const json = this.pendingDriveBackupJson;
    const fileName = this.driveFileName.trim();
    this.pendingDriveBackupJson = null;
    if (!json || !fileName) {
      return;
    }

    this.statusMessageKey = 'config.driveConnecting';
    try {
      const accessToken = await this.googleDriveService.requestAccessToken();
      await this.googleDriveService.uploadBackup(accessToken, json, fileName);
      this.statusMessageKey = 'config.driveBackupSuccess';
    } catch {
      this.statusMessageKey = 'config.driveBackupError';
    }
  }

  async startDriveRestore(): Promise<void> {
    // Requested directly inside this click handler, still tied to the user
    // gesture, so the Google sign-in popup doesn't get blocked.
    this.statusMessageKey = 'config.driveConnecting';
    try {
      const accessToken = await this.googleDriveService.requestAccessToken();
      this.pendingDriveRestoreFiles = await this.googleDriveService.listBackups(accessToken);
      this.statusMessageKey = null;
    } catch {
      this.statusMessageKey = 'config.driveRestoreError';
    }
  }

  cancelDriveRestore(): void {
    this.pendingDriveRestoreFiles = null;
  }

  async confirmDriveRestore(file: DriveBackupFile): Promise<void> {
    this.pendingDriveRestoreFiles = null;
    this.statusMessageKey = 'config.driveConnecting';
    try {
      const accessToken = await this.googleDriveService.requestAccessToken();
      const json = await this.googleDriveService.downloadBackup(accessToken, file.id);
      const data = JSON.parse(json);
      await this.indexedDbService.importAll(data);
      this.statusMessageKey = 'config.importSuccess';
    } catch {
      this.statusMessageKey = 'config.importError';
    }
  }

  onBodyWeightValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let sanitized = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
    const firstDotIndex = sanitized.indexOf('.');
    if (firstDotIndex !== -1) {
      const integerPart = sanitized.slice(0, firstDotIndex);
      const decimalPart = sanitized.slice(firstDotIndex + 1).replace(/\./g, '').slice(0, 2);
      sanitized = `${integerPart}.${decimalPart}`;
    }
    if (parseFloat(sanitized) > BODY_WEIGHT_MAX) {
      sanitized = String(BODY_WEIGHT_MAX);
    }
    input.value = sanitized;
    this.newBodyWeightValue = sanitized;
  }

  async addBodyWeightEntry(): Promise<void> {
    const weight = Math.round(Math.min(parseFloat(this.newBodyWeightValue), BODY_WEIGHT_MAX) * 100) / 100;
    if (!Number.isFinite(weight) || weight <= 0 || !this.newBodyWeightTimestamp) {
      return;
    }
    const entry: BodyWeightEntry = {
      id: crypto.randomUUID(),
      weight,
      timestamp: new Date(this.newBodyWeightTimestamp).toISOString()
    };
    await this.indexedDbService.add(STORES.bodyWeightEntries, entry);
    this.bodyWeightEntries = [...this.bodyWeightEntries, entry];
    this.newBodyWeightValue = '';
    this.newBodyWeightTimestamp = this.currentLocalDateTime();
  }

  requestDeleteBodyWeightEntry(id: string): void {
    this.pendingDeleteBodyWeightId = id;
  }

  cancelDeleteBodyWeightEntry(): void {
    this.pendingDeleteBodyWeightId = null;
  }

  async confirmDeleteBodyWeightEntry(id: string): Promise<void> {
    this.pendingDeleteBodyWeightId = null;
    await this.indexedDbService.delete(STORES.bodyWeightEntries, id);
    this.bodyWeightEntries = this.bodyWeightEntries.filter((entry) => entry.id !== id);
  }
}
