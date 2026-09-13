import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '../../core/i18n/translate.service';
import { ConnectionType } from '../../models/connection.model';
import { MergeStatus, MergeStatusReason, MergeStatusState } from '../../models/merge-request.model';

/** Délai avant apparition de l'infobulle (ms), plus long que le défaut Material (RG-017-08). */
const TOOLTIP_SHOW_DELAY_MS = 300;

/** Codes de raison portant un compteur (RG-017-06), avec la clé i18n dédiée quand il est présent. */
const COUNTED_REASON_KEYS: Partial<Record<MergeStatusReason['code'], string>> = {
  not_approved: 'board.mergeRequests.mergeStatus.reasons.not_approved_count',
  discussions_unresolved: 'board.mergeRequests.mergeStatus.reasons.discussions_unresolved_count',
};

/**
 * Icône cerclée de mergeabilité (US-017, RG-017-03/07/08) : coche verte
 * (`mergeable`), croix rouge (`blocked`, avec la liste des raisons en
 * infobulle) ou pointillé gris (`unknown`). Purement présentationnel — reçoit
 * `mergeStatus` déjà calculé par le backend, ne recalcule rien.
 */
@Component({
  selector: 'app-merge-status-icon',
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './merge-status-icon.component.html',
  styleUrl: './merge-status-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MergeStatusIconComponent {
  private readonly i18n = inject(TranslateService);

  readonly mergeStatus = input.required<MergeStatus>();
  /** Forge de la connexion du projet de cette MR (RG-019-22), pour le libellé « unknown » (RG-020-09). */
  readonly connectionType = input.required<ConnectionType>();

  protected readonly tooltipShowDelay = TOOLTIP_SHOW_DELAY_MS;

  /** Nom de l'icône Lucide correspondant à l'état (RG-017-03). */
  protected readonly icon = computed(() => iconForState(this.mergeStatus().state));

  /** Classe CSS de couleur correspondant à l'état (RG-017-03). */
  protected readonly iconClass = computed(() => classForState(this.mergeStatus().state));

  /**
   * Texte complet de l'infobulle (RG-017-08), également posé en `aria-label`
   * sur l'icône : une ligne fixe pour `mergeable`/`unknown`, un titre suivi
   * d'une ligne « – raison » par élément de `reasons` (ordre RG-017-04) pour
   * `blocked`.
   */
  protected readonly tooltip = computed(() => {
    const { state, reasons } = this.mergeStatus();
    if (state === 'mergeable') {
      return this.i18n.translate('board.mergeRequests.mergeStatus.mergeable');
    }
    if (state === 'unknown') {
      const forgeKey =
        this.connectionType() === 'github'
          ? 'settings.connections.form.typeGithub'
          : 'settings.connections.form.typeGitlab';
      return this.i18n.translate('board.mergeRequests.mergeStatus.unknown', {
        forge: this.i18n.translate(forgeKey),
      });
    }
    const lines = reasons.map((reason) => `– ${this.translateReason(reason)}`);
    return [this.i18n.translate('board.mergeRequests.mergeStatus.blockedTitle'), ...lines].join('\n');
  });

  private translateReason(reason: MergeStatusReason): string {
    if (reason.count !== undefined) {
      const key = COUNTED_REASON_KEYS[reason.code];
      if (key) {
        return this.i18n.translate(key, { count: reason.count });
      }
    }
    return this.i18n.translate(`board.mergeRequests.mergeStatus.reasons.${reason.code}`);
  }
}

function iconForState(state: MergeStatusState): 'circle-check' | 'circle-x' | 'circle-dashed' {
  if (state === 'mergeable') {
    return 'circle-check';
  }
  if (state === 'blocked') {
    return 'circle-x';
  }
  return 'circle-dashed';
}

function classForState(state: MergeStatusState): 'success' | 'danger' | 'neutral' {
  if (state === 'mergeable') {
    return 'success';
  }
  if (state === 'blocked') {
    return 'danger';
  }
  return 'neutral';
}
