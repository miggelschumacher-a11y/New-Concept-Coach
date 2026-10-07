import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { ThemeService } from './core/services/theme.service';
import { PurchasesService } from './core/services/purchases.service';
import { APP_VERSION } from './core/app-version';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Concept Coach';
  readonly appVersion = APP_VERSION;

  // Dismissed by a tap anywhere on it, or automatically once this fires -
  // whichever comes first (dismissSplash guards against running twice).
  showSplash = true;
  private splashTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly themeService: ThemeService,
    private readonly purchasesService: PurchasesService
  ) {}

  async ngOnInit(): Promise<void> {
    this.splashTimeoutId = setTimeout(() => this.dismissSplash(), 2000);
    await this.themeService.applyPersistedTheme();
    await this.purchasesService.initialize();
  }

  ngOnDestroy(): void {
    clearTimeout(this.splashTimeoutId);
  }

  dismissSplash(): void {
    this.showSplash = false;
    clearTimeout(this.splashTimeoutId);
  }
}
