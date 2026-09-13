import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '../../core/i18n/translate.service';
import { computeInitials } from './compute-initials';

/**
 * Identité visuelle d'un utilisateur GitLab (RG-G12) : avatar réel si
 * disponible, sinon initiales calculées depuis `name`. Carré 28 px, tooltip
 * = nom complet. `variant="filled"` (auteur/« Moi ») ou `"outlined"`
 * (reviewer/affecté, US-005). `highlighted` entoure l'avatar d'un anneau
 * accent et ajoute un suffixe au tooltip quand cet utilisateur est
 * l'identité configurée (RG-023-07/10).
 */
@Component({
  selector: 'app-avatar',
  imports: [MatTooltipModule],
  template: `
    <span class="avatar" [class]="variant()" [class.highlighted]="highlighted()" [matTooltip]="tooltip()">
      @if (avatarUrl(); as url) {
        <img [src]="url" [alt]="name()" />
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

  protected readonly initials = computed(() => computeInitials(this.name()));

  protected readonly tooltip = computed(() =>
    this.highlighted()
      ? `${this.name()} ${this.i18n.translate('board.mergeRequests.meSuffix')}`
      : this.name(),
  );
}
