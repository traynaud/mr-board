import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import { ReadyDelaySectionComponent } from './ready-delay-section.component';

@Component({
  imports: [ReadyDelaySectionComponent],
  template: `<app-ready-delay-section [form]="form" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
}

describe('ReadyDelaySectionComponent', () => {
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

  it('should_render_the_three_ready_delay_fields_with_default_values', () => {
    expect(numberInput('readyGreenDays').value).toBe('1');
    expect(numberInput('readyOrangeDays').value).toBe('3');
    expect(el.querySelector('mat-slide-toggle')).not.toBeNull();
  });

  it('should_render_the_workdays_only_label', () => {
    expect(el.textContent).toContain(t('settings.readyDelay.workdaysOnly'));
  });

  it('should_not_render_a_section_title', () => {
    expect(el.querySelector('.block-title')).toBeNull();
  });

  it('should_update_the_form_when_a_field_is_edited', async () => {
    const input = numberInput('readyGreenDays');
    input.value = '2';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(host.form.controls.readyGreenDays.value).toBe(2);
  });

  it('should_show_the_cross_field_error_on_ready_orange_days', async () => {
    host.form.controls.readyGreenDays.setValue(3);
    host.form.controls.readyOrangeDays.setValue(3);
    host.form.controls.readyOrangeDays.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.textContent).toContain(t('settings.readyDelay.errors.mustExceedReadyGreen'));
  });

  describe.each([['readyGreenDays', 0]] as const)(
    '%s field validation messages',
    (name, min) => {
      it('should_show_the_integer_error', async () => {
        host.form.controls[name].setValue(2.5);
        host.form.controls[name].markAsTouched();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(el.textContent).toContain(t('settings.readyDelay.errors.integer'));
      });

      it('should_show_the_min_error', async () => {
        host.form.controls[name].setValue(min - 1);
        host.form.controls[name].markAsTouched();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(el.textContent).toContain(t('settings.readyDelay.errors.min', { min }));
      });
    },
  );

  describe.each([['readyOrangeDays', 'readyGreenDays', 0]] as const)(
    '%s field validation messages (guarded by %s)',
    (name, reference, min) => {
      it('should_show_the_integer_error_when_the_cross_field_check_passes', async () => {
        // Le seuil de référence est mis très bas pour isoler l'erreur `integer`
        // de l'erreur `mustExceed` (sinon les deux se déclenchent ensemble).
        host.form.controls[reference].setValue(-100);
        host.form.controls[name].setValue(2.5);
        host.form.controls[name].markAsTouched();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(host.form.controls[name].hasError('mustExceed')).toBe(false);
        expect(el.textContent).toContain(t('settings.readyDelay.errors.integer'));
      });

      it('should_show_the_min_error_when_the_cross_field_check_passes', async () => {
        // Le seuil de référence est mis très bas pour isoler l'erreur `min`
        // de l'erreur `mustExceed` (sinon les deux se déclenchent ensemble).
        host.form.controls[reference].setValue(-100);
        host.form.controls[name].setValue(min - 1);
        host.form.controls[name].markAsTouched();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(host.form.controls[name].hasError('mustExceed')).toBe(false);
        expect(el.textContent).toContain(t('settings.readyDelay.errors.min', { min }));
      });
    },
  );
});
