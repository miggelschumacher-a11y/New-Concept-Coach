import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { SettingsService, WeightUnit, DateFormat } from '../core/services/settings.service';
import { IndexedDbService } from '../core/services/indexed-db.service';

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss'
})
export class ConfigComponent {
  weightUnit: WeightUnit;
  dateFormat: DateFormat;
  statusMessage = '';

  constructor(
    private readonly settingsService: SettingsService,
    private readonly indexedDbService: IndexedDbService
  ) {
    const settings = this.settingsService.getSettings();
    this.weightUnit = settings.weightUnit;
    this.dateFormat = settings.dateFormat;
  }

  onWeightUnitChange(): void {
    this.settingsService.updateSettings({ weightUnit: this.weightUnit });
  }

  onDateFormatChange(): void {
    this.settingsService.updateSettings({ dateFormat: this.dateFormat });
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
    this.statusMessage = 'Daten wurden exportiert.';
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
      this.statusMessage = 'Daten wurden importiert.';
    } catch {
      this.statusMessage = 'Import fehlgeschlagen: ungültige Datei.';
    } finally {
      input.value = '';
    }
  }

  async resetData(): Promise<void> {
    if (!confirm('Wirklich alle lokalen Daten unwiderruflich löschen?')) {
      return;
    }
    await this.indexedDbService.clearAll();
    this.statusMessage = 'Alle Daten wurden gelöscht.';
  }
}
