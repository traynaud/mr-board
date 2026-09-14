import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideI18nTesting, t } from '../../core/i18n/testing';
import { AvatarComponent } from './avatar.component';

@Component({
  imports: [AvatarComponent],
  template: `<app-avatar
    [name]="name()"
    [avatarUrl]="avatarUrl()"
    [variant]="variant()"
    [highlighted]="highlighted()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly name = signal('Marie Dupont');
  readonly avatarUrl = signal<string | null>(null);
  readonly variant = signal<'filled' | 'outlined'>('filled');
  readonly highlighted = signal(false);
}

describe('AvatarComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('should_render_initials_and_tooltip_when_no_avatar_url', async () => {
    const { fixture, el } = await setup();

    expect(el.querySelector('.initials')?.textContent?.trim()).toBe('MD');
    expect(el.querySelector('img')).toBeNull();
    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe('Marie Dupont');
  });

  it('should_render_image_with_alt_when_avatar_url_is_set', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.avatarUrl.set('https://gitlab.com/a.png');
    await fixture.whenStable();

    const img = el.querySelector<HTMLImageElement>('img');
    expect(img?.src).toBe('https://gitlab.com/a.png');
    expect(img?.alt).toBe('Marie Dupont');
    expect(el.querySelector('.initials')).toBeNull();
  });

  it('should_fallback_to_initials_when_the_image_fails_to_load_rg_024_01', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.avatarUrl.set('https://gitlab.com/broken.png');
    await fixture.whenStable();
    expect(el.querySelector('img')).not.toBeNull();

    el.querySelector<HTMLImageElement>('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.initials')?.textContent?.trim()).toBe('MD');
    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe('Marie Dupont');
  });

  it('should_not_retry_the_same_url_after_it_already_failed_rg_024_02', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.avatarUrl.set('https://gitlab.com/broken.png');
    await fixture.whenStable();
    el.querySelector<HTMLImageElement>('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    // Un re-rendu sans changement d'URL (ex. re-render du parent) ne doit
    // jamais réafficher l'<img> cassée.
    fixture.componentInstance.highlighted.set(true);
    await fixture.whenStable();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.initials')).not.toBeNull();
  });

  it('should_retry_loading_a_new_url_after_a_previous_failure_rg_024_02', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.avatarUrl.set('https://gitlab.com/broken.png');
    await fixture.whenStable();
    el.querySelector<HTMLImageElement>('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el.querySelector('img')).toBeNull();

    fixture.componentInstance.avatarUrl.set('https://gitlab.com/new.png');
    await fixture.whenStable();

    const img = el.querySelector<HTMLImageElement>('img');
    expect(img?.src).toBe('https://gitlab.com/new.png');
    expect(el.querySelector('.initials')).toBeNull();
  });

  it('should_apply_filled_variant_by_default_and_outlined_when_set', async () => {
    const { fixture, el } = await setup();
    expect(el.querySelector('.avatar')?.classList.contains('filled')).toBe(true);

    fixture.componentInstance.variant.set('outlined');
    await fixture.whenStable();
    expect(el.querySelector('.avatar')?.classList.contains('outlined')).toBe(true);
  });

  it('should_fallback_to_placeholder_initials_for_empty_name', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.name.set('');
    await fixture.whenStable();

    expect(el.querySelector('.initials')?.textContent?.trim()).toBe('?');
  });

  it('should_not_apply_the_highlighted_class_by_default', async () => {
    const { el } = await setup();

    expect(el.querySelector('.avatar')?.classList.contains('highlighted')).toBe(false);
  });

  it('should_apply_the_highlighted_class_and_suffix_the_tooltip_when_highlighted', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.highlighted.set(true);
    await fixture.whenStable();

    expect(el.querySelector('.avatar')?.classList.contains('highlighted')).toBe(true);
    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(`Marie Dupont ${t('board.mergeRequests.meSuffix')}`);
  });

  it('should_not_suffix_the_tooltip_when_not_highlighted', async () => {
    const { fixture } = await setup();

    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe('Marie Dupont');
  });

  it('should_apply_the_highlighted_ring_around_a_profile_photo', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.avatarUrl.set('https://gitlab.com/a.png');
    fixture.componentInstance.highlighted.set(true);
    await fixture.whenStable();

    expect(el.querySelector('img')).not.toBeNull();
    expect(el.querySelector('.avatar')?.classList.contains('highlighted')).toBe(true);
    const tooltip = fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
    expect(tooltip.message).toBe(`Marie Dupont ${t('board.mergeRequests.meSuffix')}`);
  });
});
