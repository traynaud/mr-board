import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { TestConnectionState } from '../../../../stores/settings.store';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { GitlabConnectionSectionComponent } from './gitlab-connection-section.component';

@Component({
  imports: [GitlabConnectionSectionComponent],
  template: `
    <app-gitlab-connection-section
      [form]="form"
      [tokenConfigured]="tokenConfigured()"
      [tokenHint]="tokenHint()"
      [test]="test()"
      [canTest]="canTest()"
      (testRequested)="requested = requested + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
  readonly tokenConfigured = signal(false);
  readonly tokenHint = signal<string | null>(null);
  readonly test = signal<TestConnectionState>({ status: 'idle', result: null, errorKey: null });
  readonly canTest = signal(true);
  requested = 0;
}

describe('GitlabConnectionSectionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideIcons()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const tokenInput = () => el.querySelector<HTMLInputElement>('input[formControlName="gitlabToken"]')!;
  const testButton = () => el.querySelector<HTMLButtonElement>('.test-button')!;

  it('should_show_no_token_hint_by_default', () => {
    expect(el.querySelector('.token-hint')?.textContent?.trim()).toBe(
      t('settings.connection.tokenNone'),
    );
    expect(tokenInput().placeholder).toBe('');
  });

  it('should_show_configured_hint_and_keep_placeholder', async () => {
    host.tokenConfigured.set(true);
    host.tokenHint.set('wxyz');
    await fixture.whenStable();

    expect(el.querySelector('.token-hint')?.textContent?.trim()).toBe(
      t('settings.connection.tokenConfigured', { hint: 'wxyz' }),
    );
    expect(tokenInput().placeholder).toBe(t('settings.connection.tokenKeepPlaceholder'));
  });

  it('should_toggle_token_visibility', async () => {
    const toggle = el.querySelector<HTMLButtonElement>('.toggle-token')!;
    expect(tokenInput().type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe(t('settings.connection.showToken'));

    toggle.click();
    await fixture.whenStable();
    expect(tokenInput().type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe(t('settings.connection.hideToken'));

    toggle.click();
    await fixture.whenStable();
    expect(tokenInput().type).toBe('password');
  });

  it('should_emit_test_request_and_honour_can_test', async () => {
    testButton().click();
    expect(host.requested).toBe(1);

    host.canTest.set(false);
    await fixture.whenStable();
    expect(testButton().disabled).toBe(true);
  });

  it('should_render_pending_state', async () => {
    host.test.set({ status: 'pending', result: null, errorKey: null });
    await fixture.whenStable();

    expect(testButton().textContent?.trim()).toBe(t('settings.connection.testing'));
    expect(el.querySelector('.test-result')?.textContent?.trim()).toBe(
      t('settings.connection.testing'),
    );
  });

  it('should_render_success_with_expiry', async () => {
    host.test.set({
      status: 'success',
      errorKey: null,
      result: {
        username: 'mdupont',
        name: 'Marie Dupont',
        avatarUrl: null,
        expiresAt: '2027-03-12',
        expirationKnown: true,
      },
    });
    await fixture.whenStable();

    const result = el.querySelector('.test-result')!;
    expect(result.classList.contains('success')).toBe(true);
    expect(result.querySelector('mat-icon')).not.toBeNull();
    expect(result.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `${t('settings.connection.result.connected', { name: 'Marie Dupont', username: 'mdupont' })} · ${t('settings.connection.result.expires', { date: '12/03/2027' })}`,
    );
  });

  it.each([
    [{ expiresAt: null, expirationKnown: true }, 'settings.connection.result.noExpiry'],
    [{ expiresAt: null, expirationKnown: false }, 'settings.connection.result.unknownExpiry'],
  ])('should_render_success_variant %j', async (partial, key) => {
    host.test.set({
      status: 'success',
      errorKey: null,
      result: { username: 'u', name: 'N', avatarUrl: null, ...partial },
    });
    await fixture.whenStable();

    expect(el.querySelector('.test-result')?.textContent).toContain(t(key));
  });

  it('should_render_error_from_key', async () => {
    host.test.set({ status: 'error', result: null, errorKey: 'errors.gitlab.auth' });
    await fixture.whenStable();

    const result = el.querySelector('.test-result')!;
    expect(result.classList.contains('error')).toBe(true);
    expect(result.textContent?.trim()).toBe(t('errors.gitlab.auth'));
  });

  it('should_show_validation_errors', async () => {
    host.form.controls.gitlabUrl.setValue('nope');
    host.form.controls.gitlabUrl.markAsTouched();
    host.form.controls.gitlabToken.setValue('abc');
    host.form.controls.gitlabToken.markAsTouched();
    await fixture.whenStable();

    const errors = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(errors).toContain(t('settings.connection.urlInvalid'));
    expect(errors).toContain(t('settings.connection.tokenTooShort', { min: 8 }));
  });
});
