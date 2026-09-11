import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { MeIdentity } from '../../me-identity';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { MeSectionComponent } from './me-section.component';

@Component({
  imports: [MeSectionComponent],
  template: `<app-me-section [form]="form" [identity]="identity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
  readonly identity = signal<MeIdentity>({
    status: 'unset',
    username: null,
    name: null,
    avatarUrl: null,
  });
}

describe('MeSectionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('should_render_username_and_email_fields', () => {
    expect(el.querySelector('input[formControlName="meUsername"]')).not.toBeNull();
    expect(el.querySelector('input[formControlName="meEmail"]')).not.toBeNull();
  });

  it('should_hide_preview_when_unset', () => {
    expect(el.querySelector('.identity-preview')).toBeNull();
  });

  it('should_show_matched_identity_with_full_name', async () => {
    host.identity.set({
      status: 'matched',
      username: 'mdupont',
      name: 'Marie Dupont',
      avatarUrl: 'https://gitlab.com/a.png',
    });
    await fixture.whenStable();

    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('Marie Dupont');
    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.matched'),
    );
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://gitlab.com/a.png');
  });

  it('should_show_manual_status_with_username_fallback', async () => {
    host.identity.set({
      status: 'manual',
      username: 'lrousseau',
      name: null,
      avatarUrl: null,
    });
    await fixture.whenStable();

    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('@lrousseau');
    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.manual'),
    );
  });

  it('should_show_mismatch_status', async () => {
    host.identity.set({
      status: 'mismatch',
      username: 'kbenali',
      name: null,
      avatarUrl: null,
    });
    await fixture.whenStable();

    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('@kbenali');
    expect(el.querySelector('.identity-status')?.textContent?.trim()).toBe(
      t('settings.me.status.mismatch'),
    );
  });

  it('should_reflect_identity_changes_even_without_form_control_changing', async () => {
    // Régression : displayName ne doit dépendre que de `identity()`, jamais
    // d'une lecture impérative du FormControl (voir revue de US-002).
    host.identity.set({ status: 'manual', username: 'first', name: null, avatarUrl: null });
    await fixture.whenStable();
    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('@first');

    host.identity.set({ status: 'manual', username: 'second', name: null, avatarUrl: null });
    await fixture.whenStable();
    expect(el.querySelector('.identity-name')?.textContent?.trim()).toBe('@second');
  });

  it('should_show_email_validation_error', async () => {
    host.form.controls.meEmail.setValue('marie@');
    host.form.controls.meEmail.markAsTouched();
    await fixture.whenStable();

    expect(el.querySelector('mat-error')?.textContent?.trim()).toBe(t('settings.me.emailInvalid'));
  });
});
