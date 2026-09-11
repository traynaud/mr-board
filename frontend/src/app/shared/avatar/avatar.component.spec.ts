import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { AvatarComponent } from './avatar.component';

@Component({
  imports: [AvatarComponent],
  template: `<app-avatar [name]="name()" [avatarUrl]="avatarUrl()" [variant]="variant()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly name = signal('Marie Dupont');
  readonly avatarUrl = signal<string | null>(null);
  readonly variant = signal<'filled' | 'outlined'>('filled');
}

describe('AvatarComponent', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
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
});
