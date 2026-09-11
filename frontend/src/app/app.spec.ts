import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { provideI18nTesting, t } from './core/i18n/testing';
import { provideIcons } from './shared/icons/provide-icons';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
      ],
    }).compileComponents();
  });

  it('should_create_the_app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should_route_root_to_board_page', async () => {
    const harness = await RouterTestingHarness.create('/');

    expect(harness.routeNativeElement?.textContent).toContain(t('board.title'));
  });

  it('should_route_settings_to_settings_page', async () => {
    const harness = await RouterTestingHarness.create('/settings');

    expect(harness.routeNativeElement?.textContent).toContain(t('settings.title'));
  });

  it('should_redirect_unknown_routes_to_board', async () => {
    const harness = await RouterTestingHarness.create('/nope');

    expect(harness.routeNativeElement?.textContent).toContain(t('board.title'));
  });
});
