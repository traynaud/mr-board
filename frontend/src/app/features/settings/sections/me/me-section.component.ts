import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';
import { MeIdentity } from '../../me-identity';
import { SettingsForm } from '../../settings-form';

/** Clé i18n du tag affiché pour chaque état de {@link MeIdentity}. */
const STATUS_KEYS: Record<Exclude<MeIdentity['status'], 'unset'>, string> = {
  matched: 'settings.me.status.matched',
  mismatch: 'settings.me.status.mismatch',
  manual: 'settings.me.status.manual',
};

/**
 * Section « 01 · Moi » : username, email (optionnel), aperçu de l'identité
 * résolue (RG-002-03). Composant présentationnel : la résolution de
 * l'identité est calculée par la page (`resolveMeIdentity`).
 */
@Component({
  selector: 'app-me-section',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, TranslatePipe, AvatarComponent],
  templateUrl: './me-section.component.html',
  styleUrl: './me-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeSectionComponent {
  readonly form = input.required<SettingsForm>();
  readonly identity = input.required<MeIdentity>();

  /** Nom affiché à côté de l'avatar : nom complet connu, sinon le username lui-même. */
  protected readonly displayName = computed(() => {
    const identity = this.identity();
    return identity.name ?? `@${identity.username ?? ''}`;
  });

  protected readonly statusKey = computed(() => {
    const status = this.identity().status;
    return status === 'unset' ? null : STATUS_KEYS[status];
  });
}
