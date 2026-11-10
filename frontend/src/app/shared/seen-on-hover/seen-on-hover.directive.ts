import { Directive, OnDestroy, effect, input, output } from '@angular/core';

/** Durée de survol continu avant qu'un élément soit considéré comme « vu » (RG-043-04). */
export const SEEN_HOVER_DELAY_MS = 500;

/**
 * Émet `seenOnHover` quand le pointeur — ou le focus clavier — reste {@link SEEN_HOVER_DELAY_MS} ms sur
 * l'élément (US-043, RG-043-04). Quitter l'élément avant l'échéance, ou désactiver la directive, annule
 * l'attente : un simple passage de la souris ne compte pas. Inactive quand `appSeenOnHover` vaut `false`.
 */
@Directive({
  selector: '[appSeenOnHover]',
  host: {
    '(mouseenter)': 'arm()',
    '(mouseleave)': 'cancel()',
    '(focusin)': 'arm()',
    '(focusout)': 'cancel()',
  },
})
export class SeenOnHoverDirective implements OnDestroy {
  /** Active la détection du survol. */
  readonly enabled = input.required<boolean>({ alias: 'appSeenOnHover' });
  readonly seenOnHover = output<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (!this.enabled()) {
        this.cancel();
      }
    });
  }

  protected arm(): void {
    if (!this.enabled() || this.timer !== null) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.seenOnHover.emit();
    }, SEEN_HOVER_DELAY_MS);
  }

  protected cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.cancel();
  }
}
