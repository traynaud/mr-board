import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SEEN_HOVER_DELAY_MS, SeenOnHoverDirective } from './seen-on-hover.directive';

@Component({
  imports: [SeenOnHoverDirective],
  template: `<div id="target" [appSeenOnHover]="enabled()" (seenOnHover)="seen = seen + 1"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly enabled = signal(true);
  seen = 0;
}

describe('SeenOnHoverDirective', () => {
  async function setup() {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const target = (fixture.nativeElement as HTMLElement).querySelector('#target')!;
    return { fixture, host: fixture.componentInstance, target };
  }

  afterEach(() => vi.useRealTimers());

  it('should_emit_once_after_the_delay_of_continuous_hover', async () => {
    const { host, target } = await setup();
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(SEEN_HOVER_DELAY_MS - 1);
    expect(host.seen).toBe(0);
    vi.advanceTimersByTime(1);
    expect(host.seen).toBe(1);
    vi.advanceTimersByTime(5_000);
    expect(host.seen).toBe(1);
  });

  it('should_not_emit_when_the_pointer_leaves_before_the_delay', async () => {
    const { host, target } = await setup();
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(SEEN_HOVER_DELAY_MS - 100);
    target.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(5_000);
    expect(host.seen).toBe(0);
  });

  it('should_restart_the_wait_on_each_new_entry', async () => {
    const { host, target } = await setup();
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);
    target.dispatchEvent(new MouseEvent('mouseleave'));
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);
    expect(host.seen).toBe(0);
    vi.advanceTimersByTime(SEEN_HOVER_DELAY_MS);
    expect(host.seen).toBe(1);
  });

  it('should_do_nothing_when_disabled', async () => {
    const { host, fixture, target } = await setup();
    host.enabled.set(false);
    fixture.detectChanges();
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(5_000);
    expect(host.seen).toBe(0);
  });

  it('should_cancel_a_pending_wait_when_disabled_meanwhile', async () => {
    const { host, fixture, target } = await setup();
    target.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);
    host.enabled.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(5_000);
    expect(host.seen).toBe(0);
  });

  it('should_cancel_a_pending_wait_when_destroyed', async () => {
    const { host, fixture, target } = await setup();
    target.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.destroy();
    vi.advanceTimersByTime(5_000);
    expect(host.seen).toBe(0);
  });

  it('should_also_emit_after_a_sustained_keyboard_focus_inside_the_element', async () => {
    const { host, target } = await setup();
    target.dispatchEvent(new FocusEvent('focusin'));
    vi.advanceTimersByTime(SEEN_HOVER_DELAY_MS);
    expect(host.seen).toBe(1);
  });

  it('should_not_emit_when_the_focus_leaves_before_the_delay', async () => {
    const { host, target } = await setup();
    target.dispatchEvent(new FocusEvent('focusin'));
    vi.advanceTimersByTime(SEEN_HOVER_DELAY_MS - 100);
    target.dispatchEvent(new FocusEvent('focusout'));
    vi.advanceTimersByTime(5_000);
    expect(host.seen).toBe(0);
  });
});
