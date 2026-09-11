import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService, TranslationParams } from './translate.service';

/**
 * `{{ 'board.toolbar.refresh' | translate }}` ou
 * `{{ 'board.ready.days' | translate: { days: 3 } }}`.
 * Pipe impur : réévalué après le chargement du dictionnaire.
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
