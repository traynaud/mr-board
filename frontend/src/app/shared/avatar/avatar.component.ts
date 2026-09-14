import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '../../core/i18n/translate.service';
import { computeInitials } from './compute-initials';

/**
 * Identité visuelle d'un utilisateur GitLab (RG-G12) : avatar réel si
 * disponible, sinon initiales calculées depuis `name` — y compris quand
 * `avatarUrl` est non nul mais que l'image échoue à charger (lien mort,
 * RG-024-01). Carré 28 px, tooltip = nom complet. `variant="filled"`
 * (auteur/« Moi ») ou `"outlined"` (reviewer/affecté, US-005). `highlighted`
 * entoure l'avatar d'un anneau accent et ajoute un suffixe au tooltip quand
 * cet utilisateur est l'identité configurée (RG-023-07/10).
 */
@Component({
  selector: 'app-avatar',
  imports: [MatTooltipModule],
  template: `
    <span class="avatar" [class]="variant()" [class.highlighted]="highlighted()" [matTooltip]="tooltip()">
      @if (showImage(); as url) {
        <img [src]="url" [alt]="name()" (error)="onImageError()" />
      } @else {
        <span class="initials">{{ initials() }}</span>
      }
    </span>
  `,
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  private readonly i18n = inject(TranslateService);

  /** Nom complet (ou username si inconnu) : sert au tooltip et aux initiales. */
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly variant = input<'filled' | 'outlined'>('filled');
  /** Anneau accent (RG-023-07) : vrai quand cet avatar est celui de l'identité configurée. */
  readonly highlighted = input(false);

  /** RG-024-01/02 : bascule sur les initiales dès l'échec de chargement, jusqu'à ce que `avatarUrl` change. */
  private readonly imageFailed = signal(false);

  protected readonly showImage = computed(() => (this.imageFailed() ? null : this.avatarUrl()));

  protected readonly initials = computed(() => computeInitials(this.name()));

  protected readonly tooltip = computed(() =>
    this.highlighted()
      ? `${this.name()} ${this.i18n.translate('board.mergeRequests.meSuffix')}`
      : this.name(),
  );

  constructor() {
    // RG-024-02 : une nouvelle URL (ex. resynchronisation) mérite une
    // nouvelle tentative de chargement, même après un précédent échec.
    effect(() => {
      this.avatarUrl();
      this.imageFailed.set(false);
    });
  }

  /** RG-024-01 : bascule sur les initiales sans jamais retenter cette même URL (pas de boucle de requêtes). */
  protected onImageError(): void {
    this.imageFailed.set(true);
  }
}
