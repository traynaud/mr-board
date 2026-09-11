import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { provideIcons } from '../../shared/icons/provide-icons';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
      ],
    }).compileComponents();
  });

  it('should_render_header_with_back_cancel_and_save', async () => {
    const fixture = TestBed.createComponent(SettingsPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.nav-brand')?.textContent?.trim()).toBe(t('settings.title'));
    expect(el.querySelector('a[mat-icon-button]')?.getAttribute('href')).toBe('/');
    expect(el.querySelector('a[mat-button]')?.textContent?.trim()).toBe(t('common.cancel'));
    const save = el.querySelector<HTMLButtonElement>('button[mat-flat-button]');
    expect(save?.textContent?.trim()).toBe(t('common.save'));
    expect(save?.disabled).toBe(true);
  });
});
