import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { Connection } from '../../../../models/connection.model';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';
import { IdentityForm } from '../../connections-form';
import { MeIdentity } from '../../me-identity';
import { SettingsForm } from '../../settings-form';

/** Clé i18n du tag affiché pour chaque état de {@link MeIdentity}. */
const STATUS_KEYS: Record<Exclude<MeIdentity['status'], 'unset'>, string> = {
  matched: 'settings.me.status.matched',
  mismatch: 'settings.me.status.mismatch',
  manual: 'settings.me.status.manual',
};

/** Une ligne d'identité par connexion (RG-019-08), appariée par index avec `identities()`. */
export interface IdentityRow {
  connection: Connection;
  group: IdentityForm;
  identity: MeIdentity;
}

/**
 * Section « 01 · Moi » : email global, une ligne « Nom d'utilisateur sur
 * <connexion> » par connexion avec son aperçu d'identité (RG-002-03,
 * RG-019-07/08), case « Surligner mes MRs… » (RG-023-02, indépendante de
 * toute connexion, RG-019-24). Composant présentationnel : la résolution de
 * chaque identité est calculée par la page (`resolveMeIdentity`).
 */
@Component({
  selector: 'app-me-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    RouterLink,
    TranslatePipe,
    AvatarComponent,
  ],
  templateUrl: './me-section.component.html',
  styleUrl: './me-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeSectionComponent {
  readonly form = input.required<SettingsForm>();
  /** Une entrée par connexion existante (RG-019-08) ; vide si aucune connexion (RG-019-08). */
  readonly identities = input.required<IdentityRow[]>();

  /** Nom affiché à côté de l'avatar : nom complet connu, sinon le username lui-même. */
  protected displayName(identity: MeIdentity): string {
    return identity.name ?? `@${identity.username ?? ''}`;
  }

  protected statusKey(identity: MeIdentity): string | null {
    return identity.status === 'unset' ? null : STATUS_KEYS[identity.status];
  }
}
