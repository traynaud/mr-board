import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { computeInitials } from './compute-initials';

/**
 * Identité visuelle d'un utilisateur GitLab (RG-G12) : avatar réel si
 * disponible, sinon initiales calculées depuis `name`. Carré 28 px, tooltip
 * = nom complet. `variant="filled"` (auteur/« Moi ») ou `"outlined"`
 * (reviewer/affecté, US-005).
 */
@Component({
  selector: 'app-avatar',
  imports: [MatTooltipModule],
  template: `
    <span class="avatar" [class]="variant()" [matTooltip]="name()">
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
  /** Nom complet (ou username si inconnu) : sert au tooltip et aux initiales. */
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly variant = input<'filled' | 'outlined'>('filled');

  protected readonly initials = computed(() => computeInitials(this.name()));
}
