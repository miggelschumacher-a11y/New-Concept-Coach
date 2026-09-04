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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import {
  SettingsService,
  WeightUnit,
  DateFormat,
  Language,
  LANGUAGE_DATE_FORMATS,
  FinishedSessionReplenishMode
} from '../core/services/settings.service';
import { DoubleProgressionMode } from '../core/models/training-plan.model';
import { IndexedDbService } from '../core/services/indexed-db.service';
import { DriveBackupFile, GoogleDriveService } from '../core/services/google-drive.service';
import { LANGUAGES } from '../core/services/translation.service';
import { BodyWeightService } from '../core/services/body-weight.service';
import { findHeartRateMax, parseHeartRateRange } from '../core/data/heart-rate-zones';
import { TRAINING_ZONES, TrainingZone } from '../core/data/training-zones';
import { BodyWeightEntry } from '../core/models/body-weight-entry.model';
import { TranslatePipe } from '../core/pipes/translate.pipe';
import { SelectOnFocusDirective } from '../core/directives/select-on-focus.directive';

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
    MatExpansionModule,
    MatRadioModule,
    DatePipe,
    DecimalPipe,
    TranslatePipe,
    SelectOnFocusDirective
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
  doubleProgressionLowerReps: number;
  doubleProgressionUpperReps: number;
  doubleProgressionMode: DoubleProgressionMode;
  repGoalTotalRepGoal: number;
  waveProgressionInitialReps: number;
  waveProgressionFinalReps: number;
  waveProgressionRepsDecrement: number;
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
    private readonly googleDriveService: GoogleDriveService,
    private readonly bodyWeightService: BodyWeightService
  ) {
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
    this.language = settings.language;
    this.dateOfBirth = settings.dateOfBirth ?? '';
    this.finishedSessionReplenishMode = settings.finishedSessionReplenishMode;
    this.doubleProgressionLowerReps = settings.doubleProgressionLowerReps;
    this.doubleProgressionUpperReps = settings.doubleProgressionUpperReps;
    this.doubleProgressionMode = settings.doubleProgressionMode;
    this.repGoalTotalRepGoal = settings.repGoalTotalRepGoal;
    this.waveProgressionInitialReps = settings.waveProgressionInitialReps;
    this.waveProgressionFinalReps = settings.waveProgressionFinalReps;
    this.waveProgressionRepsDecrement = settings.waveProgressionRepsDecrement;
  }

  async ngOnInit(): Promise<void> {
    await this.settingsService.whenReady();
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
    this.language = settings.language;
    this.dateOfBirth = settings.dateOfBirth ?? '';
    this.finishedSessionReplenishMode = settings.finishedSessionReplenishMode;
    this.doubleProgressionLowerReps = settings.doubleProgressionLowerReps;
    this.doubleProgressionUpperReps = settings.doubleProgressionUpperReps;
    this.doubleProgressionMode = settings.doubleProgressionMode;
    this.repGoalTotalRepGoal = settings.repGoalTotalRepGoal;
    this.waveProgressionInitialReps = settings.waveProgressionInitialReps;
    this.waveProgressionFinalReps = settings.waveProgressionFinalReps;
    this.waveProgressionRepsDecrement = settings.waveProgressionRepsDecrement;
    this.bodyWeightEntries = await this.bodyWeightService.getAll();
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

  onRepRangeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '').slice(0, 3);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  private clampReps(value: string): number {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 1;
  }

  async onDoubleProgressionLowerRepsChange(value: string): Promise<void> {
    this.doubleProgressionLowerReps = this.clampReps(value);
    await this.settingsService.updateSettings({ doubleProgressionLowerReps: this.doubleProgressionLowerReps });
  }

  async onDoubleProgressionUpperRepsChange(value: string): Promise<void> {
    this.doubleProgressionUpperReps = this.clampReps(value);
    await this.settingsService.updateSettings({ doubleProgressionUpperReps: this.doubleProgressionUpperReps });
  }

  async onDoubleProgressionModeChange(): Promise<void> {
    await this.settingsService.updateSettings({ doubleProgressionMode: this.doubleProgressionMode });
  }

  async onRepGoalTotalRepGoalChange(value: string): Promise<void> {
    this.repGoalTotalRepGoal = this.clampReps(value);
    await this.settingsService.updateSettings({ repGoalTotalRepGoal: this.repGoalTotalRepGoal });
  }

  async onWaveProgressionInitialRepsChange(value: string): Promise<void> {
    this.waveProgressionInitialReps = this.clampReps(value);
    await this.settingsService.updateSettings({ waveProgressionInitialReps: this.waveProgressionInitialReps });
  }

  async onWaveProgressionFinalRepsChange(value: string): Promise<void> {
    this.waveProgressionFinalReps = this.clampReps(value);
    await this.settingsService.updateSettings({ waveProgressionFinalReps: this.waveProgressionFinalReps });
  }

  async onWaveProgressionRepsDecrementChange(value: string): Promise<void> {
    this.waveProgressionRepsDecrement = this.clampReps(value);
    await this.settingsService.updateSettings({ waveProgressionRepsDecrement: this.waveProgressionRepsDecrement });
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

  async onRestoreFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      await this.indexedDbService.importAll(data);
      this.statusMessageKey = 'config.importSuccess';
    } catch {
      this.statusMessageKey = 'config.importError';
    }
  }

  // Same 4-int/2-decimal mask as every other weight field in the app (see
  // e.g. TrainingPlansComponent.onWeightIncrementFieldInput) - the
  // BODY_WEIGHT_MAX ceiling is still enforced on commit, in addBodyWeightEntry.
  onBodyWeightValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.newBodyWeightValue = input.value;
  }

  async addBodyWeightEntry(): Promise<void> {
    const parsed = parseFloat(this.newBodyWeightValue.replace(',', '.'));
    const weight = Math.round(Math.min(parsed, BODY_WEIGHT_MAX) * 100) / 100;
    if (!Number.isFinite(weight) || weight <= 0 || !this.newBodyWeightTimestamp) {
      return;
    }
    const entry: BodyWeightEntry = {
      id: crypto.randomUUID(),
      weight,
      timestamp: new Date(this.newBodyWeightTimestamp).toISOString()
    };
    await this.bodyWeightService.add(entry);
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
    await this.bodyWeightService.delete(id);
    this.bodyWeightEntries = this.bodyWeightEntries.filter((entry) => entry.id !== id);
  }
}
