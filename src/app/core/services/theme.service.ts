import { Injectable } from '@angular/core';
import { SettingsService, Theme } from './settings.service';

// Toggling this class (see styles.scss) swaps the Material color layer -
// mat.all-component-colors($light-theme) - and the handful of hand-picked
// dark colors used outside Material's own theming (see the --app-* custom
// properties in styles.scss).
const LIGHT_THEME_CLASS = 'light-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  constructor(private readonly settingsService: SettingsService) {}

  // Called once from AppComponent on startup, after settings have loaded -
  // applies whatever theme was last persisted.
  async applyPersistedTheme(): Promise<void> {
    await this.settingsService.whenReady();
    this.applyTheme(this.settingsService.getSettings().theme);
  }

  async setTheme(theme: Theme): Promise<void> {
    this.applyTheme(theme);
    await this.settingsService.updateSettings({ theme });
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle(LIGHT_THEME_CLASS, theme === 'light');
  }
}
