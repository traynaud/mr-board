import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../../../core/i18n/testing';
import { HISTORY_EVENT_TYPES } from '../../../../models/history.model';
import { SettingsForm, buildSettingsForm } from '../../settings-form';
import {
  NOTIFICATION_TYPE_GROUPS,
  NotificationTypesSectionComponent,
} from './notification-types-section.component';

@Component({
  imports: [NotificationTypesSectionComponent],
  template: `<app-notification-types-section [form]="form" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly form: SettingsForm = buildSettingsForm();
}

describe('NotificationTypesSectionComponent', () => {
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

  const boxes = () => Array.from(el.querySelectorAll<HTMLElement>('mat-checkbox'));
  const input = (box: HTMLElement) => box.querySelector<HTMLInputElement>('input')!;
  const boxOf = (label: string) => boxes().find((box) => box.textContent?.trim() === label)!;
  const disabled = () => host.form.controls.notifDisabledTypes.value;

  it('should_cover_the_18_event_types_exactly_once_in_three_groups_rg_041_01', () => {
    const grouped = NOTIFICATION_TYPE_GROUPS.flatMap((group) => group.types);

    expect([...grouped].sort()).toEqual([...HISTORY_EVENT_TYPES].sort());
    expect(new Set(grouped).size).toBe(18);
    expect(NOTIFICATION_TYPE_GROUPS).toHaveLength(3);
    expect(boxes()).toHaveLength(18);
  });

  it('should_check_every_type_by_default_rg_041_02', () => {
    expect(boxes().every((box) => input(box).checked)).toBe(true);
  });

  it('should_add_a_type_to_the_disabled_list_when_unchecked_and_mark_the_form_dirty', async () => {
    input(boxOf(t('settings.notifications.types.labels.commented'))).click();
    await fixture.whenStable();

    expect(disabled()).toEqual(['commented']);
    expect(host.form.controls.notifDisabledTypes.dirty).toBe(true);
  });

  it('should_remove_a_type_from_the_disabled_list_when_checked_again', async () => {
    host.form.controls.notifDisabledTypes.setValue(['commented', 'merged']);
    await fixture.whenStable();
    expect(input(boxOf(t('settings.notifications.types.labels.commented'))).checked).toBe(false);

    input(boxOf(t('settings.notifications.types.labels.commented'))).click();
    await fixture.whenStable();

    expect(disabled()).toEqual(['merged']);
  });

  it('should_uncheck_then_check_a_whole_group_only', async () => {
    const buttons = el.querySelectorAll<HTMLButtonElement>('section.group:nth-of-type(3) button.link');

    buttons[1].click(); // « Tout décocher » du groupe Contenu
    await fixture.whenStable();
    expect([...disabled()].sort()).toEqual(
      ['commented', 'label_added', 'label_removed', 'title_changed'].sort(),
    );

    buttons[0].click(); // « Tout cocher »
    await fixture.whenStable();
    expect(disabled()).toEqual([]);
  });

  it('should_follow_programmatic_changes_such_as_reset_and_import', async () => {
    host.form.controls.notifDisabledTypes.setValue(['approved']);
    await fixture.whenStable();

    expect(input(boxOf(t('settings.notifications.types.labels.approved'))).checked).toBe(false);
    expect(boxes().filter((box) => !input(box).checked)).toHaveLength(1);

    host.form.controls.notifDisabledTypes.setValue([]);
    await fixture.whenStable();
    expect(boxes().every((box) => input(box).checked)).toBe(true);
  });
});
