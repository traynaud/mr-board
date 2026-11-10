import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { AppDateAdapter } from './app-date-adapter';
import { dateToDay, dayToDate } from '../../../core/url-state/history-query-params';
import { formatShortDate } from '../../../shared/format/format-date';

/** Période choisie, en jours locaux inclus (RG-038-09). */
export interface HistoryPeriod {
  from: string | null;
  to: string | null;
}

/**
 * Pastille + menu « Période » de la timeline : deux sélecteurs de date « Du » / « Au »
 * (une seule borne est autorisée, « Du » ≤ « Au » imposé par `min` / `max`, RG-038-09).
 */
@Component({
  selector: 'app-history-period-pill',
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    TranslatePipe,
  ],
  providers: [
    provideNativeDateAdapter(),
    // Après l'adaptateur natif pour le remplacer : lecture / affichage JJ/MM/AAAA (fr) ou AAAA-MM-JJ (en).
    AppDateAdapter,
    { provide: DateAdapter, useExisting: AppDateAdapter },
    {
      provide: MAT_DATE_LOCALE,
      useFactory: () => (inject(TranslateService).language() === 'en' ? 'en-GB' : 'fr-FR'),
    },
  ],
  templateUrl: './history-period-pill.component.html',
  styleUrl: './history-period-pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPeriodPillComponent {
  private readonly i18n = inject(TranslateService);

  readonly from = input.required<string | null>();
  readonly to = input.required<string | null>();

  readonly periodChange = output<HistoryPeriod>();
  readonly remove = output<void>();

  protected readonly menuOpen = signal(false);
  protected readonly fromDate = computed(() => (this.from() ? dayToDate(this.from() as string) : null));
  protected readonly toDate = computed(() => (this.to() ? dayToDate(this.to() as string) : null));

  /** « Période : 06/11/2026 → 08/11/2026 » (une borne absente s'affiche « … »). */
  protected readonly pillLabel = computed(() => {
    const name = this.i18n.translate('history.filters.names.period');
    const language = this.i18n.language();
    const from = this.from();
    const to = this.to();
    if (from === null && to === null) {
      return `${name} : ${this.i18n.translate('history.filters.all')}`;
    }
    return `${name} : ${from ? formatShortDate(from, language) : '…'} → ${to ? formatShortDate(to, language) : '…'}`;
  });

  protected readonly removeAriaLabel = computed(() =>
    this.i18n.translate('history.filters.remove', {
      name: this.i18n.translate('history.filters.names.period'),
    }),
  );

  protected onFrom(event: MatDatepickerInputEvent<Date>): void {
    this.periodChange.emit({ from: event.value ? dateToDay(event.value) : null, to: this.to() });
  }

  protected onTo(event: MatDatepickerInputEvent<Date>): void {
    this.periodChange.emit({ from: this.from(), to: event.value ? dateToDay(event.value) : null });
  }

  protected clearPeriod(): void {
    this.periodChange.emit({ from: null, to: null });
  }
}
