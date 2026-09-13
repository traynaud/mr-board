import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { Connection } from '../../../../models/connection.model';
import { buildIdentityGroup } from '../../connections-form';
import { MeIdentity } from '../../me-identity';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { IdentityRow, MeSectionComponent } from './me-section.component';

const UNSET_IDENTITY: MeIdentity = { status: 'unset', username: null, name: null, avatarUrl: null };

function connection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 1,
    type: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.com',
    tokenConfigured: true,
    tokenHint: 'wxyz',
    meUsername: null,
    projectsCount: 0,
    ...overrides,
  };
}

@Component({
  imports: [MeSectionComponent],
  template: `<app-me-section [form]="form" [identities]="identities()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
  readonly identities = signal<IdentityRow[]>([]);
}

describe('MeSectionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('should_show_the_no_connection_message_when_there_is_no_connection', () => {
    expect(el.querySelector('.no-connection')).not.toBeNull();
    expect(el.querySelector('input[formControlName="username"]')).toBeNull();
  });

  it('should_render_one_username_field_per_connection_and_the_email_field', () => {
    host.identities.set([
      { connection: connection(), group: buildIdentityGroup(connection()), identity: UNSET_IDENTITY },
      {
        connection: connection({ id: 2, name: 'gitlab.exemple.fr' }),
        group: buildIdentityGroup(connection({ id: 2, name: 'gitlab.exemple.fr' })),
        identity: UNSET_IDENTITY,
      },
    ]);
    fixture.detectChanges();

    const usernameInputs = el.querySelectorAll('input[formControlName="username"]');
    expect(usernameInputs.length).toBe(2);
    expect(el.querySelector('input[formControlName="meEmail"]')).not.toBeNull();
    expect(el.querySelector('.no-connection')).toBeNull();
  });

  it('should_hide_preview_when_unset', () => {
    host.identities.set([
      { connection: connection(), group: buildIdentityGroup(connection()), identity: UNSET_IDENTITY },
    ]);
    fixture.detectChanges();

    expect(el.querySelector('.identity-preview')).toBeNull();
  });

  it('should_show_matched_identity_with_full_name', () => {
    host.identities.set([
      {
        connection: connection(),
        group: buildIdentityGroup(connection()),
        identity: {
          status: 'matched',
          username: 'mdupont',
          name: 'Marie Dupont',
          avatarUrl: 'https://gitlab.com/a.png',
        },
      },
    ]);
    fixture.detectChanges();

    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('Marie Dupont');
    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.matched'),
    );
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://gitlab.com/a.png');
  });

  it('should_show_manual_status_with_username_fallback', () => {
    host.identities.set([
      {
        connection: connection(),
        group: buildIdentityGroup(connection()),
        identity: { status: 'manual', username: 'lrousseau', name: null, avatarUrl: null },
      },
    ]);
    fixture.detectChanges();

    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('@lrousseau');
    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.manual'),
    );
  });

  it('should_show_mismatch_status', () => {
    host.identities.set([
      {
        connection: connection(),
        group: buildIdentityGroup(connection()),
        identity: { status: 'mismatch', username: 'kbenali', name: null, avatarUrl: null },
      },
    ]);
    fixture.detectChanges();

    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('@kbenali');
    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.mismatch'),
    );
  });

  it('should_show_email_validation_error', async () => {
    host.form.controls.meEmail.setValue('marie@');
    host.form.controls.meEmail.markAsTouched();
    await fixture.whenStable();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(t('settings.me.emailInvalid'));
  });

  it('should_render_the_highlight_me_checkbox_checked_by_default', () => {
    const checkbox = el.querySelector('mat-checkbox[formControlName="highlightMe"]');

    expect(checkbox).not.toBeNull();
    expect(checkbox?.querySelector('input')?.checked).toBe(true);
    expect(checkbox?.textContent?.trim()).toBe(t('settings.me.highlightMe'));
  });

  it('should_uncheck_highlight_me_and_mark_the_form_dirty', async () => {
    el.querySelector<HTMLInputElement>('mat-checkbox[formControlName="highlightMe"] input')!.click();
    await fixture.whenStable();

    expect(host.form.controls.highlightMe.value).toBe(false);
    expect(host.form.controls.highlightMe.dirty).toBe(true);
  });
});
