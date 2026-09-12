import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResizableColumnDirective } from './resizable-column.directive';

@Component({
  imports: [ResizableColumnDirective],
  template: `
    <button type="button" (click)="parentClickCount = parentClickCount + 1">
      <span
        appResizableColumn
        [currentWidth]="width()"
        [ariaLabel]="'Redimensionner la colonne Projet'"
        [minWidth]="minWidth()"
        [maxWidth]="maxWidth()"
        (widthChange)="lastWidth = $event"
        (resetRequested)="resetCount = resetCount + 1"
      ></span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly width = signal(80);
  readonly minWidth = signal(40);
  readonly maxWidth = signal(800);
  lastWidth: number | null = null;
  resetCount = 0;
  parentClickCount = 0;
}

describe('ResizableColumnDirective', () => {
  // jsdom n'implémente pas la Pointer Capture API (voir archi.md) — stubbée
  // ici plutôt que dans la directive, pour ne pas polluer le code de
  // production avec une garde utile uniquement en test.
  // Réassignés (pas restaurés) avant chaque test : une simple affectation
  // suffit à isoler les tests entre eux, sans dépendre de la sémantique de
  // `vi.restoreAllMocks()` sur des `vi.fn()` qui n'enveloppent aucune
  // implémentation native préexistante (jsdom ne fournit pas ces méthodes).
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    Element.prototype.releasePointerCapture = vi.fn();
  });

  const setup = async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const handle = fixture.nativeElement.querySelector('[appResizableColumn]') as HTMLElement;
    return { fixture, handle };
  };

  function pointerEvent(type: string, clientX: number, pointerId = 1): PointerEvent {
    return new PointerEvent(type, { clientX, pointerId, bubbles: true });
  }

  it('should_expose_aria_separator_attributes', async () => {
    const { handle } = await setup();

    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Redimensionner la colonne Projet');
    expect(handle.getAttribute('aria-valuenow')).toBe('80');
    expect(handle.getAttribute('aria-valuemin')).toBe('40');
    expect(handle.getAttribute('aria-valuemax')).toBe('800');
    expect(handle.getAttribute('tabindex')).toBe('0');
  });

  it('should_emit_the_new_width_continuously_while_dragging', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', 140));
    await fixture.whenStable();
    expect(fixture.componentInstance.lastWidth).toBe(120);

    handle.dispatchEvent(pointerEvent('pointermove', 150));
    await fixture.whenStable();
    expect(fixture.componentInstance.lastWidth).toBe(130);
  });

  it('should_clamp_to_minWidth_while_dragging_left', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', -200));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastWidth).toBe(40);
  });

  it('should_clamp_to_maxWidth_while_dragging_right', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', 5000));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastWidth).toBe(800);
  });

  it('should_ignore_pointermove_without_an_active_capture', async () => {
    const { fixture, handle } = await setup();
    vi.spyOn(Element.prototype, 'hasPointerCapture').mockReturnValue(false);

    handle.dispatchEvent(pointerEvent('pointermove', 500));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastWidth).toBeNull();
  });

  it('should_release_the_pointer_capture_on_pointerup', async () => {
    const { handle } = await setup();
    const releaseSpy = vi.spyOn(Element.prototype, 'releasePointerCapture');

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointerup', 140));

    expect(releaseSpy).toHaveBeenCalled();
  });

  it('should_emit_reset_requested_on_double_click', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.resetCount).toBe(1);
  });

  it('should_widen_by_8px_on_arrow_right', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastWidth).toBe(88);
  });

  it('should_narrow_by_8px_on_arrow_left', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastWidth).toBe(72);
  });

  it('should_clamp_arrow_adjustments_too', async () => {
    const { fixture, handle } = await setup();
    fixture.componentInstance.width.set(42);
    await fixture.whenStable();

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.lastWidth).toBe(40);
  });

  it('should_not_bubble_a_plain_click_up_to_a_parent_handler', async () => {
    const { fixture, handle } = await setup();

    handle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.parentClickCount).toBe(0);
  });
});
