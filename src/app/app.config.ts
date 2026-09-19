import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { OriginPageReuseStrategy } from './core/services/origin-page-reuse.strategy';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    { provide: RouteReuseStrategy, useClass: OriginPageReuseStrategy },
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => (inject(RouteReuseStrategy) as OriginPageReuseStrategy).listenForNavigations()
    },
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
