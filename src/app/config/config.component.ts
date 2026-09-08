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
import { MatTabsModule } from '@angular/material/tabs';
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
import { DumbbellsService } from '../core/services/dumbbells.service';
import { DumbbellEntry } from '../core/models/dumbbell-entry.model';
import { PlatesService } from '../core/services/plates.service';
import { PlateEntry } from '../core/models/plate-entry.model';
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
    MatTabsModule,
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
  dumbbellEntries: DumbbellEntry[] = [];
  newDumbbellName = '';
  newDumbbellWeight = '';
  newDumbbellDiameter = '';
  pendingDeleteDumbbellId: string | null = null;
  dumbbellDuplicateError = false;
  plateEntries: PlateEntry[] = [];
  newPlateQuantity = '';
  newPlateWeight = '';
  newPlateDiameter = '';
  pendingDeletePlateId: string | null = null;
  plateDuplicateError = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly indexedDbService: IndexedDbService,
    private readonly googleDriveService: GoogleDriveService,
    private readonly bodyWeightService: BodyWeightService,
    private readonly dumbbellsService: DumbbellsService,
    private readonly platesService: PlatesService
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
    this.dumbbellEntries = await this.dumbbellsService.getAll();
    this.plateEntries = await this.platesService.getAll();
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

  get sortedDumbbellEntries(): DumbbellEntry[] {
    return [...this.dumbbellEntries].sort((a, b) => a.name.localeCompare(b.name));
  }

  get sortedPlateEntries(): PlateEntry[] {
    return [...this.plateEntries].sort((a, b) => a.weight - b.weight || a.diameter - b.diameter);
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

  // Same 4-int/2-decimal mask as every other weight field in the app (see
  // onBodyWeightValueInput above).
  onDumbbellWeightFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.newDumbbellWeight = input.value;
  }

  // Reformats to 2 decimal places with trailing zeros once the field is
  // left, same convention as every other weight field's blur handler.
  onDumbbellWeightFieldBlur(): void {
    const parsed = parseFloat(this.newDumbbellWeight.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      this.newDumbbellWeight = parsed.toFixed(2);
    }
  }

  // Integer, 2 digits max (0-99mm) - a dumbbell handle's diameter has no
  // decimal place, unlike weight.
  onDumbbellDiameterFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,2}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.newDumbbellDiameter = input.value;
  }

  // The name/weight/diameter combination identifies one physical dumbbell -
  // adding the same combination twice would just be a duplicate row with no
  // extra meaning, so it's rejected with dumbbellDuplicateError shown below
  // the form (see addDumbbellEntry). excludeId lets an edit to an existing
  // entry check against every *other* entry without flagging itself.
  // Case-insensitive on the name ("langhantel" and "Langhantel" are the same
  // dumbbell) - weight and diameter still compare as plain numbers, which
  // have no case to normalize.
  private isDuplicateDumbbell(name: string, weight: number, diameter: number, excludeId?: string): boolean {
    const normalizedName = name.toLowerCase();
    return this.dumbbellEntries.some(
      (entry) =>
        entry.id !== excludeId &&
        entry.name.toLowerCase() === normalizedName &&
        entry.weight === weight &&
        entry.diameter === diameter
    );
  }

  async addDumbbellEntry(): Promise<void> {
    this.dumbbellDuplicateError = false;
    const name = this.newDumbbellName.trim().slice(0, 50);
    const weight = Math.round(parseFloat(this.newDumbbellWeight.replace(',', '.')) * 100) / 100;
    const diameter = parseInt(this.newDumbbellDiameter, 10);
    if (!name || !Number.isFinite(weight) || weight <= 0 || !Number.isFinite(diameter) || diameter <= 0) {
      return;
    }
    if (this.isDuplicateDumbbell(name, weight, diameter)) {
      this.dumbbellDuplicateError = true;
      return;
    }
    const entry: DumbbellEntry = { id: crypto.randomUUID(), name, weight, diameter };
    await this.dumbbellsService.add(entry);
    this.dumbbellEntries = [...this.dumbbellEntries, entry];
    this.newDumbbellName = '';
    this.newDumbbellWeight = '';
    this.newDumbbellDiameter = '';
  }

  requestDeleteDumbbellEntry(id: string): void {
    this.pendingDeleteDumbbellId = id;
  }

  cancelDeleteDumbbellEntry(): void {
    this.pendingDeleteDumbbellId = null;
  }

  async confirmDeleteDumbbellEntry(id: string): Promise<void> {
    this.pendingDeleteDumbbellId = null;
    await this.dumbbellsService.delete(id);
    this.dumbbellEntries = this.dumbbellEntries.filter((entry) => entry.id !== id);
  }

  // Same masks as the add-form's own fields (onDumbbellWeightFieldInput /
  // onDumbbellDiameterFieldInput above), just without the newDumbbell*
  // component state - an existing row's input is edited in place, so the
  // sanitized text only ever needs to land back in that same input element.
  onDumbbellWeightEditInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  onDumbbellDiameterEditInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,2}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Each of these commits on blur/change of its own field, re-running the
  // same duplicate check as addDumbbellEntry (excluding this row itself) so
  // an edit can never create a second identical dumbbell. An invalid or
  // rejected edit reverts the input's DOM value directly, since Angular's
  // property binding skips the DOM write when the bound model value (which
  // an invalid/rejected edit never changes) hasn't changed.
  async updateDumbbellEntryName(entry: DumbbellEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const name = input.value.trim().slice(0, 50);
    if (!name) {
      input.value = entry.name;
      return;
    }
    if (this.isDuplicateDumbbell(name, entry.weight, entry.diameter, entry.id)) {
      this.dumbbellDuplicateError = true;
      input.value = entry.name;
      return;
    }
    this.dumbbellDuplicateError = false;
    entry.name = name;
    input.value = name;
    await this.dumbbellsService.update(entry);
  }

  async updateDumbbellEntryWeight(entry: DumbbellEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const parsed = parseFloat(input.value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = entry.weight.toFixed(2);
      return;
    }
    const weight = Math.round(parsed * 100) / 100;
    if (this.isDuplicateDumbbell(entry.name, weight, entry.diameter, entry.id)) {
      this.dumbbellDuplicateError = true;
      input.value = entry.weight.toFixed(2);
      return;
    }
    this.dumbbellDuplicateError = false;
    entry.weight = weight;
    input.value = weight.toFixed(2);
    await this.dumbbellsService.update(entry);
  }

  async updateDumbbellEntryDiameter(entry: DumbbellEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = String(entry.diameter);
      return;
    }
    if (this.isDuplicateDumbbell(entry.name, entry.weight, parsed, entry.id)) {
      this.dumbbellDuplicateError = true;
      input.value = String(entry.diameter);
      return;
    }
    this.dumbbellDuplicateError = false;
    entry.diameter = parsed;
    input.value = String(parsed);
    await this.dumbbellsService.update(entry);
  }

  // Integer, 4 digits max - how many of this plate the user owns.
  onPlateQuantityFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.newPlateQuantity = input.value;
  }

  // Same 4-int/2-decimal mask as every other weight field in the app (see
  // onBodyWeightValueInput above).
  onPlateWeightFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.newPlateWeight = input.value;
  }

  // Reformats to 2 decimal places with trailing zeros once the field is
  // left, same convention as every other weight field's blur handler.
  onPlateWeightFieldBlur(): void {
    const parsed = parseFloat(this.newPlateWeight.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      this.newPlateWeight = parsed.toFixed(2);
    }
  }

  // Integer, 2 digits max (0-99mm) - a plate's center-hole diameter has no
  // decimal place, unlike weight.
  onPlateDiameterFieldInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,2}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    this.newPlateDiameter = input.value;
  }

  // Unlike dumbbells, plates have no name - the weight/diameter combination
  // alone identifies one physical plate type, so it's the duplicate key;
  // quantity is just how many of that type are owned. excludeId lets an edit
  // to an existing entry check against every *other* entry without flagging
  // itself.
  private isDuplicatePlate(weight: number, diameter: number, excludeId?: string): boolean {
    return this.plateEntries.some((entry) => entry.id !== excludeId && entry.weight === weight && entry.diameter === diameter);
  }

  async addPlateEntry(): Promise<void> {
    this.plateDuplicateError = false;
    const quantity = parseInt(this.newPlateQuantity, 10);
    const weight = Math.round(parseFloat(this.newPlateWeight.replace(',', '.')) * 100) / 100;
    const diameter = parseInt(this.newPlateDiameter, 10);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(weight) || weight <= 0 || !Number.isFinite(diameter) || diameter <= 0) {
      return;
    }
    if (this.isDuplicatePlate(weight, diameter)) {
      this.plateDuplicateError = true;
      return;
    }
    const entry: PlateEntry = { id: crypto.randomUUID(), quantity, weight, diameter };
    await this.platesService.add(entry);
    this.plateEntries = [...this.plateEntries, entry];
    this.newPlateQuantity = '';
    this.newPlateWeight = '';
    this.newPlateDiameter = '';
  }

  requestDeletePlateEntry(id: string): void {
    this.pendingDeletePlateId = id;
  }

  cancelDeletePlateEntry(): void {
    this.pendingDeletePlateId = null;
  }

  async confirmDeletePlateEntry(id: string): Promise<void> {
    this.pendingDeletePlateId = null;
    await this.platesService.delete(id);
    this.plateEntries = this.plateEntries.filter((entry) => entry.id !== id);
  }

  // Same masks as the add-form's own fields (onPlateQuantityFieldInput /
  // onPlateWeightFieldInput / onPlateDiameterFieldInput above), just without
  // the newPlate* component state - an existing row's input is edited in
  // place, so the sanitized text only ever needs to land back in that same
  // input element.
  onPlateQuantityEditInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  onPlateWeightEditInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,4}([.,]\d{0,2})?/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  onPlateDiameterEditInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.match(/^\d{0,2}/)?.[0] ?? '';
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
  }

  // Each of these commits on blur/change of its own field. Weight/diameter
  // re-run the same duplicate check as addPlateEntry (excluding this row
  // itself) so an edit can never create a second identical plate; quantity
  // isn't part of that identity, so it only needs its own bounds check. An
  // invalid or rejected edit reverts the input's DOM value directly, since
  // Angular's property binding skips the DOM write when the bound model
  // value (which an invalid/rejected edit never changes) hasn't changed.
  async updatePlateEntryQuantity(entry: PlateEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = String(entry.quantity);
      return;
    }
    entry.quantity = parsed;
    input.value = String(parsed);
    await this.platesService.update(entry);
  }

  async updatePlateEntryWeight(entry: PlateEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const parsed = parseFloat(input.value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = entry.weight.toFixed(2);
      return;
    }
    const weight = Math.round(parsed * 100) / 100;
    if (this.isDuplicatePlate(weight, entry.diameter, entry.id)) {
      this.plateDuplicateError = true;
      input.value = entry.weight.toFixed(2);
      return;
    }
    this.plateDuplicateError = false;
    entry.weight = weight;
    input.value = weight.toFixed(2);
    await this.platesService.update(entry);
  }

  async updatePlateEntryDiameter(entry: PlateEntry, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const parsed = parseInt(input.value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      input.value = String(entry.diameter);
      return;
    }
    if (this.isDuplicatePlate(entry.weight, parsed, entry.id)) {
      this.plateDuplicateError = true;
      input.value = String(entry.diameter);
      return;
    }
    this.plateDuplicateError = false;
    entry.diameter = parsed;
    input.value = String(parsed);
    await this.platesService.update(entry);
  }
}
