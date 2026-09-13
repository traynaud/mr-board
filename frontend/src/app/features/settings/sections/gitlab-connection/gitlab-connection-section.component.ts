import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../../core/i18n/translate.service';
import { formatShortDate } from '../../../../shared/format/format-date';
import { TestConnectionState } from '../../../../stores/settings.store';
import { SettingsForm, TOKEN_MIN_LENGTH } from '../../settings-form';

/**
 * Section « 02 · Connexion GitLab » : URL, jeton (masquable), test de connexion.
 * Composant présentationnel : le formulaire et l'état du test viennent de la page.
 */
@Component({
  selector: 'app-gitlab-connection-section',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './gitlab-connection-section.component.html',
  styleUrl: './gitlab-connection-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GitlabConnectionSectionComponent {
  private readonly i18n = inject(TranslateService);

  readonly form = input.required<SettingsForm>();
  readonly tokenConfigured = input.required<boolean>();
  readonly tokenHint = input<string | null>(null);
  readonly test = input.required<TestConnectionState>();
  /** Activation du bouton de test, calculée par la page (RG-001-05). */
  readonly canTest = input.required<boolean>();

  /** Demande d'exécution du test de connexion. */
  readonly testRequested = output<void>();

  protected readonly showToken = signal(false);
  protected readonly tokenMinLength = TOKEN_MIN_LENGTH;

  protected readonly tokenHintLabel = computed(() =>
    this.tokenConfigured()
      ? this.i18n.translate('settings.connection.tokenConfigured', {
          hint: this.tokenHint() ?? '',
        })
      : this.i18n.translate('settings.connection.tokenNone'),
  );

  /** Libellé du résultat du test, selon son état. */
  protected readonly resultLabel = computed(() => {
    const test = this.test();
    switch (test.status) {
      case 'pending':
        return this.i18n.translate('settings.connection.testing');
      case 'error':
        return this.i18n.translate(test.errorKey ?? 'errors.unexpected');
      case 'success': {
        const result = test.result;
        if (!result) {
          return '';
        }
        const connected = this.i18n.translate('settings.connection.result.connected', {
          name: result.name,
          username: result.username,
        });
        const expiry = !result.expirationKnown
          ? this.i18n.translate('settings.connection.result.unknownExpiry')
          : result.expiresAt
            ? this.i18n.translate('settings.connection.result.expires', {
                date: formatShortDate(result.expiresAt, this.i18n.language()),
              })
            : this.i18n.translate('settings.connection.result.noExpiry');
        return `${connected} · ${expiry}`;
      }
      default:
        return '';
    }
  });

  protected toggleToken(): void {
    this.showToken.update((value) => !value);
  }
}
