import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

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
});
