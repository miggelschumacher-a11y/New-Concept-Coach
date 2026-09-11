import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { ThemeService } from './core/services/theme.service';
import { PurchasesService } from './core/services/purchases.service';

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
export class AppComponent implements OnInit {
  title = 'Concept Coach';

  constructor(
    private readonly themeService: ThemeService,
    private readonly purchasesService: PurchasesService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.themeService.applyPersistedTheme();
    await this.purchasesService.initialize();
  }
}
