import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { Connection } from '../../../../models/connection.model';
import { provideIcons } from '../../../../shared/icons/provide-icons';
import { ConnectionsStore } from '../../../../stores/connections.store';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { NotificationScopeSectionComponent } from './notification-scope-section.component';

@Component({
  imports: [NotificationScopeSectionComponent],
  template: `<app-notification-scope-section [form]="form" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
}

describe('NotificationScopeSectionComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const connections = signal<Connection[]>([]);
  const loading = signal(false);

  const withIdentity = (identity: Connection['identity']): Connection =>
    ({ id: 1, name: 'GitLab', type: 'gitlab', identity }) as Connection;

  beforeEach(async () => {
    connections.set([]);
    loading.set(false);
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18nTesting(),
        provideIcons(),
        { provide: ConnectionsStore, useValue: { connections, loading } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const toggle = (index: number) =>
    el.querySelectorAll<HTMLElement>('mat-slide-toggle')[index].querySelector<HTMLButtonElement>('button')!;
  const warning = () => el.querySelector('.warning');

  it('should_render_the_two_scope_options_unchecked_by_default_rg_041_06', () => {
    expect(el.querySelectorAll('mat-slide-toggle')).toHaveLength(2);
    expect(host.form.controls.notifOnlyMine.value).toBe(false);
    expect(host.form.controls.notifExcludeOwn.value).toBe(false);
    expect(toggle(0).getAttribute('aria-checked')).toBe('false');
  });

  it('should_bind_the_toggles_to_the_shared_form_and_mark_it_dirty', async () => {
    toggle(0).click();
    toggle(1).click();
    await fixture.whenStable();

    expect(host.form.controls.notifOnlyMine.value).toBe(true);
    expect(host.form.controls.notifExcludeOwn.value).toBe(true);
    expect(host.form.dirty).toBe(true);
  });

  it('should_warn_when_only_mine_is_on_without_any_resolved_identity', async () => {
    connections.set([withIdentity(null)]);
    host.form.controls.notifOnlyMine.setValue(true);
    await fixture.whenStable();

    expect(warning()?.textContent).toContain(t('settings.notifications.scope.identityWarning'));
  });

  it('should_not_warn_when_an_identity_is_resolved_or_the_option_is_off', async () => {
    connections.set([withIdentity({ username: 'me', name: 'Me', email: null, avatarUrl: null })]);
    host.form.controls.notifOnlyMine.setValue(true);
    await fixture.whenStable();
    expect(warning()).toBeNull();

    connections.set([withIdentity(null)]);
    host.form.controls.notifOnlyMine.setValue(false);
    await fixture.whenStable();
    expect(warning()).toBeNull();
  });

  it('should_not_warn_while_the_connections_are_still_loading', async () => {
    loading.set(true);
    host.form.controls.notifOnlyMine.setValue(true);
    await fixture.whenStable();

    expect(warning()).toBeNull();
  });
});
