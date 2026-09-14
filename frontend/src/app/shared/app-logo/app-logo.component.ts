import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Marque de l'application (même tracé que `public/favicon.svg`, fond
 * transparent) — un seul point de vérité visuel, réutilisé partout où le
 * logo doit apparaître (ex. `BoardToolbarComponent`, à côté du nom de l'app).
 */
@Component({
  selector: 'app-logo',
  templateUrl: './app-logo.component.html',
  styleUrl: './app-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogoComponent {}
