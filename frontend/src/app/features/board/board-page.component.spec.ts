import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { provideIcons } from '../../shared/icons/provide-icons';
import { BoardPageComponent } from './board-page.component';

describe('BoardPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
      ],
    }).compileComponents();
  });

  it('should_render_brand_and_settings_link', async () => {
    const fixture = TestBed.createComponent(BoardPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.nav-brand')?.textContent?.trim()).toBe(t('board.title'));
    const link = el.querySelector<HTMLAnchorElement>('a[mat-icon-button]');
    expect(link?.getAttribute('href')).toBe('/settings');
    expect(link?.getAttribute('aria-label')).toBe(t('board.toolbar.settings'));
  });
});
