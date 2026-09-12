import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { RefreshSectionComponent } from './refresh-section.component';

@Component({
  imports: [RefreshSectionComponent],
  template: `<app-refresh-section [form]="form" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
}

describe('RefreshSectionComponent', () => {
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

  it('should_render_a_radio_button_for_each_interval_option', () => {
    const buttons = el.querySelectorAll('mat-radio-button');
    expect(buttons.length).toBe(5);
  });

  it('should_render_the_minute_and_manual_labels', () => {
    const labels = Array.from(el.querySelectorAll('mat-radio-button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).toContain(t('settings.refresh.options.minutes', { minutes: 5 }));
    expect(labels).toContain(t('settings.refresh.options.manual'));
  });

  it('should_reflect_the_current_interval_selection', async () => {
    host.form.controls.refreshIntervalMin.setValue(15);
    await fixture.whenStable();

    expect(host.form.controls.refreshIntervalMin.value).toBe(15);
  });

  it('should_render_the_pause_when_hidden_toggle', () => {
    const toggle = el.querySelector('mat-slide-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent?.trim()).toBe(t('settings.refresh.pauseWhenHidden'));
  });

  it('should_toggle_pause_when_hidden_via_the_form', async () => {
    expect(host.form.controls.pauseWhenHidden.value).toBe(true);

    host.form.controls.pauseWhenHidden.setValue(false);
    await fixture.whenStable();

    expect(host.form.controls.pauseWhenHidden.value).toBe(false);
  });
});
