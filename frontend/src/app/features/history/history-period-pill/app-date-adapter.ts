import { Injectable, inject } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';
import { TranslateService } from '../../../core/i18n/translate.service';
import { dateToDay } from '../../../core/url-state/history-query-params';

const FRENCH_DAY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Adaptateur de dates des sélecteurs Material, aligné sur les formats de l'application (RG-022-10) :
 * `JJ/MM/AAAA` en français, `AAAA-MM-JJ` en anglais. L'adaptateur natif lit les saisies à l'américaine
 * (`01/11/2026` = 11 janvier) quelle que soit la locale : on remplace la lecture et l'affichage.
 */
@Injectable()
export class AppDateAdapter extends NativeDateAdapter {
  private readonly i18n = inject(TranslateService);

  /** Lit `JJ/MM/AAAA` ou `AAAA-MM-JJ` ; toute autre saisie est invalide, une saisie vide donne `null`. */
  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') {
      return super.parse(value);
    }
    const text = value.trim();
    if (text === '') {
      return null;
    }
    const french = FRENCH_DAY.exec(text);
    const iso = ISO_DAY.exec(text);
    const [year, month, day] = french
      ? [Number(french[3]), Number(french[2]), Number(french[1])]
      : iso
        ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
        : [NaN, NaN, NaN];
    const date = new Date(year, month - 1, day);
    const real =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return real ? date : this.invalid();
  }

  /** Affiche la date selon la langue active (RG-022-10). */
  override format(date: Date, _displayFormat?: object): string {
    if (!this.isValid(date)) {
      throw Error('AppDateAdapter: Cannot format invalid date.');
    }
    const iso = dateToDay(date);
    if (this.i18n.language() === 'en') {
      return iso;
    }
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }
}
