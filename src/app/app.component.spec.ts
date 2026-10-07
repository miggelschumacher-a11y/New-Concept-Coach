import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { APP_VERSION } from './core/app-version';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the navigation links as labelled icon buttons', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('a'));
    const ariaLabels = links.map((a) => a.getAttribute('aria-label'));
    expect(ariaLabels).toEqual(['Training Sessions', 'History', 'Training Plans', 'Exercises', 'Configuration']);
    const icons = links.map((a) => a.querySelector('mat-icon')?.textContent?.trim());
    expect(icons).toEqual(['fitness_center', 'history', 'assignment', 'directions_run', 'settings']);
  });

  it('should show the app version at the end of the navigation bar', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const toolbar = (fixture.nativeElement as HTMLElement).querySelector('mat-toolbar');
    const version = toolbar?.querySelector('.app-version');
    expect(version?.textContent?.trim()).toBe(`v${APP_VERSION}`);
    expect(toolbar?.lastElementChild).toBe(version ?? null);
  });
});
