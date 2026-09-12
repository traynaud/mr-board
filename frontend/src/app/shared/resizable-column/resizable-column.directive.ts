import { Directive, ElementRef, inject, input, output } from '@angular/core';

/** RG-012-07 : pas de clavier configurable, un seul incrément partout. */
const KEYBOARD_STEP = 8;

/**
 * Poignée de redimensionnement d'une colonne (RG-012-01/02/04/07/08).
 * Générique et sans dépendance métier : reçoit la largeur courante et un
 * `aria-label` déjà traduit, émet la nouvelle largeur (déjà bornée) et une
 * demande de réinitialisation — la persistance reste à la charge de
 * l'appelant.
 */
@Directive({
  selector: '[appResizableColumn]',
  host: {
    class: 'resize-handle',
    tabindex: '0',
    role: 'separator',
    'aria-orientation': 'vertical',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-valuenow]': 'currentWidth()',
    '[attr.aria-valuemin]': 'minWidth()',
    '[attr.aria-valuemax]': 'maxWidth()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(dblclick)': 'resetRequested.emit()',
    '(keydown.ArrowLeft)': 'onKeydown(-1)',
    '(keydown.ArrowRight)': 'onKeydown(1)',
    // RG-012-08 : la poignée est un enfant du `<th>`, qui porte lui-même le
    // gestionnaire de tri des colonnes triables (Difficulté, Depuis Ready) —
    // un simple clic (sans glisser) ne doit jamais déclencher ce tri.
    '(click)': '$event.stopPropagation()',
  },
})
export class ResizableColumnDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly currentWidth = input.required<number>();
  /** Déjà traduit par l'appelant — la directive ne connaît pas l'i18n. */
  readonly ariaLabel = input.required<string>();
  /** RG-012-02 : bornes par défaut, configurables pour rester générique. */
  readonly minWidth = input(40);
  readonly maxWidth = input(800);

  /** Nouvelle largeur, déjà bornée — émise en continu pendant le glisser et à chaque flèche. */
  readonly widthChange = output<number>();
  /** RG-012-04 : double-clic sur la poignée. */
  readonly resetRequested = output<void>();

  private dragStartX = 0;
  private dragStartWidth = 0;

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.currentWidth();
    this.host.nativeElement.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.host.nativeElement.hasPointerCapture(event.pointerId)) {
      return;
    }
    const delta = event.clientX - this.dragStartX;
    this.widthChange.emit(this.clamp(this.dragStartWidth + delta));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.host.nativeElement.hasPointerCapture(event.pointerId)) {
      this.host.nativeElement.releasePointerCapture(event.pointerId);
    }
  }

  protected onKeydown(direction: 1 | -1): void {
    this.widthChange.emit(this.clamp(this.currentWidth() + direction * KEYBOARD_STEP));
  }

  private clamp(width: number): number {
    return Math.min(this.maxWidth(), Math.max(this.minWidth(), width));
  }
}
