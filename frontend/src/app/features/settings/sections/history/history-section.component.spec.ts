import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { HistorySectionComponent } from './history-section.component';

@Component({
  imports: [HistorySectionComponent],
  template: `<app-history-section [form]="form" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
}

describe('HistorySectionComponent', () => {
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

  function numberInput(name: string): HTMLInputElement {
    return el.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
  }

  it('should_render_the_two_retention_fields_with_the_default_values', () => {
    expect(numberInput('historyRetentionDays').value).toBe('60');
    expect(numberInput('historyMaxEvents').value).toBe('5000');
  });

  it('should_render_the_unit_suffixes_and_the_cumulative_rule_hint', () => {
    expect(el.textContent).toContain(t('settings.history.daysSuffix'));
    expect(el.textContent).toContain(t('settings.history.eventsSuffix'));
    expect(el.textContent).toContain(t('settings.history.hint'));
  });

  it('should_update_the_form_when_a_field_is_edited', async () => {
    const input = numberInput('historyMaxEvents');
    input.value = '1200';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(host.form.controls.historyMaxEvents.value).toBe(1200);
  });

  it('should_show_the_range_error_when_a_value_is_out_of_bounds', async () => {
    host.form.controls.historyRetentionDays.setValue(400);
    host.form.controls.historyRetentionDays.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.textContent).toContain(
      t('settings.history.errors.range', { min: 1, max: 365 }),
    );
  });

  it('should_show_the_range_error_for_the_maximum_number_of_events', async () => {
    host.form.controls.historyMaxEvents.setValue(10);
    host.form.controls.historyMaxEvents.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.textContent).toContain(
      t('settings.history.errors.range', { min: 100, max: 100000 }),
    );
  });

  it('should_show_the_integer_error_on_a_decimal_value', async () => {
    host.form.controls.historyMaxEvents.setValue(150.5);
    host.form.controls.historyMaxEvents.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.textContent).toContain(t('settings.history.errors.integer'));
  });

  it('should_show_the_integer_error_on_a_decimal_number_of_days', async () => {
    host.form.controls.historyRetentionDays.setValue(2.5);
    host.form.controls.historyRetentionDays.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.textContent).toContain(t('settings.history.errors.integer'));
  });
});
