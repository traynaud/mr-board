import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import { ALL_FILTER_KEYS, FilterKey } from '../../../../models/merge-request.model';

/**
 * Bouton + menu « Ajouter un filtre » (RG-010-03) : les 5 filtres sont
 * toujours listés (specs.md fait foi, contrairement au prototype qui les
 * masque une fois actifs — voir archi.md « Points à clarifier ») ; un
 * filtre déjà actif y apparaît grisé avec une coche. Désactivé si les 5
 * filtres sont actifs.
 */
@Component({
  selector: 'app-add-filter-menu',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TranslatePipe],
  templateUrl: './add-filter-menu.component.html',
  styleUrl: './add-filter-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddFilterMenuComponent {
  private readonly i18n = inject(TranslateService);

  readonly active = input.required<FilterKey[]>();
  readonly addFilter = output<FilterKey>();

  protected readonly allKeys = ALL_FILTER_KEYS;

  protected isActive(key: FilterKey): boolean {
    return this.active().includes(key);
  }

  protected nameFor(key: FilterKey): string {
    return this.i18n.translate(`board.filters.pills.names.${key}`);
  }
}
