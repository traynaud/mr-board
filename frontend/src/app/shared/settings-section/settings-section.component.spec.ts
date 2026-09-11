import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { SettingsSectionComponent } from './settings-section.component';

@Component({
  imports: [SettingsSectionComponent],
  template: `
    <app-settings-section
      number="02"
      titleKey="settings.connection.title"
      descriptionKey="settings.connection.description"
      [last]="true"
    >
      <span class="projected">contenu</span>
    </app-settings-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe('SettingsSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
  });

  it('should_render_heading_description_and_projected_content', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h6')?.textContent?.trim()).toBe(
      `02 · ${t('settings.connection.title')}`,
    );
    expect(el.querySelector('.heading p')?.textContent?.trim()).toBe(
      t('settings.connection.description'),
    );
    expect(el.querySelector('.content .projected')?.textContent).toBe('contenu');
    expect(el.querySelector('.content')?.classList.contains('last')).toBe(true);
  });
});
