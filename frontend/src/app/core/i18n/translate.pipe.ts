import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService, TranslationParams } from './translate.service';

/**
 * `{{ 'board.toolbar.refresh' | translate }}` ou
 * `{{ 'board.ready.days' | translate: { days: 3 } }}`.
 * Pipe impur : réévalué après le chargement du dictionnaire, et à chaque
 * changement de langue en cours de session (RG-022-12) — la réactivité au
 * changement de langue vient de `TranslateService.translate()` elle-même
 * (qui lit le signal `language`), pas de ce pipe : n'importe quel appelant,
 * ici ou dans un `computed()` de composant, en bénéficie de la même façon.
 */
@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly service = inject(TranslateService);

  /**
   * @param key clé de traduction.
   * @param params valeurs interpolées.
   */
  transform(key: string, params?: TranslationParams): string {
    return this.service.translate(key, params);
  }
}
