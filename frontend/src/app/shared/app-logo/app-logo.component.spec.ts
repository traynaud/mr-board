import { TestBed } from '@angular/core/testing';
import { AppLogoComponent } from './app-logo.component';

describe('AppLogoComponent', () => {
  it('should_render_the_logo_svg_with_a_transparent_background', async () => {
    await TestBed.configureTestingModule({ imports: [AppLogoComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppLogoComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const svg = el.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('rect')).toBeNull();
  });

  it('should_hide_the_decorative_svg_from_assistive_technology', async () => {
    await TestBed.configureTestingModule({ imports: [AppLogoComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppLogoComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
