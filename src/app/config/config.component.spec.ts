import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ConfigComponent } from './config.component';
import { APP_VERSION } from '../core/app-version';

describe('ConfigComponent', () => {
  let component: ConfigComponent;
  let fixture: ComponentFixture<ConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigComponent],
      providers: [provideNoopAnimations()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the app version in the page header, above the first card', () => {
    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('.config-header');
    expect(header?.querySelector('.config-version')?.textContent?.trim()).toBe(`v${APP_VERSION}`);
    expect(element.firstElementChild).toBe(header);
  });
});
