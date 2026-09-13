# Design — US-018 Thème sombre

## Référence maquettes

- `docs/design/MR Board - Wireframes -sombre-.dc.html` (commit `ca05b69`) — écrans 1a, 1b, 1c en sombre
- `docs/design/MR Board - Prototype.dc.html` (commit `ca05b69`) — logique interactive de référence (source de
  vérité pour le comportement du bouton toolbar, cf. ⚠️ dans `archi.md`)
- `docs/design/MR Board - Wireframes.dc.html` — écran 1c clair, pour comparaison de l'emplacement du contrôle

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|----------------------|----------------------|
| Tableau | `/` | `BoardToolbarComponent` (nouveau bouton) |
| Paramètres › Divers | `/settings` | `MiscellaneousSectionComponent` (nouveau contrôle) |
| Tous | — | `frontend/src/index.html` (script anti-flash), `styles.scss` (tokens globaux) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|--------------------------|---------------------|------------------------------|
| Radio horizontal « Thème » (Système / Clair / Sombre) | `mat-radio-group` + `mat-radio-button` | Aucune — identique au pattern déjà en place pour `refreshIntervalMin` (`interval-group`) |
| Bouton icône lune/soleil dans la toolbar | `mat-icon-button` + `mat-icon` + `matTooltip` | Icône dynamique selon le thème effectif (voir ⚠️ archi.md) |

## Éléments visuels spécifiques

### Couleurs et thème

Tokens à définir dans `frontend/src/styles.scss`, dans un bloc dédié après le `:root` clair existant. Deux
sélecteurs, comme le prescrit RG-018-07 :

```scss
// Thème sombre — US-018 (RG-018-07/08)
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    // ... tokens ci-dessous
  }
}
:root[data-theme='dark'] {
  // ... mêmes tokens, dupliqués (pas de mixin nécessaire pour ~25 lignes)
}
```

Valeurs (RG-018-08, validées par la maquette) :

```css
--color-bg: #161514;
--color-surface: #201e1d;
--color-text: #f3f2f2;
--color-divider: color-mix(in srgb, #f3f2f2 32%, transparent);

--color-neutral-100: #242221;
--color-neutral-200: #2d2b2b;
--color-neutral-300: #444141;
--color-neutral-400: #605d5d;
--color-neutral-500: #7d7979;
--color-neutral-600: #a8a4a4;
--color-neutral-700: #bab6b6;
--color-neutral-800: #d7d3d3;
--color-neutral-900: #eae7e7;

/* --color-accent inchangé : #ec3013 */
--color-accent-100: #3a1510;
--color-accent-200: #4d170e;
--color-accent-300: #7c1405;
--color-accent-400: #ae1800;
--color-accent-500: #dd2b0f; /* interpolé, absent de la maquette (= --color-accent-600 clair) */
--color-accent-600: #ff563c;
--color-accent-700: #ff9783;
--color-accent-800: #ffc4b8;
--color-accent-900: #ffe0d9;

--color-success: #4fb26f;
--color-warning: #e9a03a;
/* --color-danger: var(--color-accent) — référence, pas de redéfinition nécessaire */

--shadow-sm: 0 0 0 1px rgba(255, 255, 255, 0.06), 0 1px 2px rgba(0, 0, 0, 0.5);
--shadow-md: 0 0 0 1px rgba(255, 255, 255, 0.07), 0 3px 10px rgba(0, 0, 0, 0.55);
--shadow-lg: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 32px rgba(0, 0, 0, 0.65);
```

Et les surcharges `--mat-sys-*` (miroir du bloc clair `styles.scss` L.92-102) :

```css
--mat-sys-surface: #161514;
--mat-sys-on-surface: #f3f2f2;
--mat-sys-on-surface-variant: #bab6b6;
--mat-sys-surface-container-lowest: #0f0e0e;
--mat-sys-surface-container-low: #1b1a19;
--mat-sys-surface-container: #242221;
--mat-sys-surface-container-high: #2d2b2b;
--mat-sys-surface-container-highest: #383535;
--mat-sys-outline: #9b9797;
--mat-sys-outline-variant: #605d5d;
--mat-sys-error: #ff563c;
```

(Le bloc Material dans `styles.scss` ne redéfinit actuellement que `color-scheme: light` en dur au niveau `html` —
prévoir `color-scheme: light dark` ou une bascule conditionnelle pour laisser le navigateur adapter ses propres
contrôles, ex. scrollbars, RG-018-09.)

### Typographie
Aucun changement (Archivo, poids inchangés).

### Layout et structure

- **Toolbar** (`board-toolbar.component.html`) : insérer le bouton entre le `<button>` Rafraîchir et le `<a>`
  Paramètres, structurellement identique à ce dernier (`mat-icon-button`) :
  ```html
  <button
    mat-icon-button
    type="button"
    [matTooltip]="themeToggleLabel()"
    [attr.aria-label]="themeToggleLabel()"
    (click)="themeToggle.emit()"
  >
    <mat-icon [svgIcon]="themeIcon()" />
  </button>
  ```
- **Section Divers** (`miscellaneous-section.component.html`) : le contrôle « Thème » est le premier élément de la
  section, avant les cases à cocher existantes, avec un libellé au-dessus comme les seuils (`settings.misc.theme.title`) :
  ```html
  <div class="theme-field">
    <span class="field-label">{{ 'settings.misc.theme.title' | translate }}</span>
    <mat-radio-group
      formControlName="theme"
      [attr.aria-label]="'settings.misc.theme.title' | translate"
      (change)="onThemeChange($event.value)"
    >
      <mat-radio-button value="system">{{ 'settings.misc.theme.system' | translate }}</mat-radio-button>
      <mat-radio-button value="light">{{ 'settings.misc.theme.light' | translate }}</mat-radio-button>
      <mat-radio-button value="dark">{{ 'settings.misc.theme.dark' | translate }}</mat-radio-button>
    </mat-radio-group>
  </div>
  ```
  `onThemeChange` appelle `themeService.setPreview(value)` (RG-018-03) ; le `FormControl` continue de porter la
  valeur pour l'état modifié/Enregistrer (`toUpdateRequest`), la preview est un pur effet de bord visuel.

### États et comportements conditionnels

- **Aperçu (RG-018-03)** : `ThemeService.preview` prime sur `persisted` tant que la section Divers est montée et
  qu'une valeur a été choisie ; `clearPreview()` est appelé au `ngOnDestroy` de `SettingsPageComponent` (pas de la
  section, pour couvrir aussi une éventuelle navigation qui démonterait la page sans démonter chaque section
  individuellement) — restaure alors `persisted` (dernier `settings.theme` connu), qu'on quitte via Annuler ou via
  confirmation du guard d'abandon (RG-001-07). Aucun code spécifique dans `cancel()` ni dans le guard : la
  destruction du composant suffit.
- **Bascule toolbar (RG-018-12/13)** : `quickToggle()` calcule `next = effective() === 'dark' ? 'light' : 'dark'`,
  applique immédiatement (`setPersisted(next)`, optimiste) puis appelle `settingsStore.save({ gitlabUrl, theme: next })`
  en tâche de fond. Échec réseau → toast d'erreur (`board-page.component.ts`, pattern déjà utilisé pour les autres
  erreurs de cette page) ; le thème reste appliqué localement (pas de rollback visuel, cohérent avec le fait que le
  prochain chargement de `GET /settings` fera de toute façon autorité, RG-018-05).
- **Mode système (RG-018-04)** : `ThemeService` écoute `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)`
  et met à jour un signal interne `systemPrefersDark` ; aucun composant ne doit accéder à `matchMedia` directement
  (RG-018-06).
- **Anti-flash (RG-018-05)** : voir script ci-dessous. Le premier rendu Angular doit retrouver le **même** attribut
  `data-theme` que celui posé par le script inline — `ThemeService` initialise donc son signal `persisted` en lisant
  la même clé `localStorage`, avant tout appel réseau.

### Interactions et animations
Aucune transition animée requise par la spec (RG-018-03 : « application sans attendre » — immédiat, pas de fade).

## Assets nécessaires

Deux icônes Lucide à ajouter à `shared/icons/provide-icons.ts` (`ICONS`), paths repris tels quels de la maquette :

```ts
sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
```

Usage (voir ⚠️ archi.md pour la justification du sens retenu) :
- Thème effectif **sombre** → icône `sun`, infobulle « Passer en thème clair »
- Thème effectif **clair** → icône `moon`, infobulle « Passer en thème sombre »

## Script anti-flash (`index.html`)

À insérer juste avant `<app-root>`, IIFE minimal (pas de dépendance Angular) :

```html
<script>
  (function () {
    try {
      var raw = localStorage.getItem('mrboard.theme.v1');
      var theme = raw === 'light' || raw === 'dark' ? raw : null;
      if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch (e) {
      // localStorage indisponible : reste en mode système (aucun attribut).
    }
  })();
</script>
<app-root></app-root>
```

`'system'` stocké (ou toute valeur invalide/absente) → aucun attribut posé → `@media (prefers-color-scheme: dark)`
tranche seul, avant même le chargement d'Angular.

## Clés i18n à ajouter (`public/i18n/fr.json`)

```json
"toolbar": {
  "settings": "Paramètres",
  "refresh": "Rafraîchir",
  "themeToLight": "Passer en thème clair",
  "themeToDark": "Passer en thème sombre"
}
```

```json
"misc": {
  "theme": {
    "title": "Thème",
    "system": "Système",
    "light": "Clair",
    "dark": "Sombre"
  }
}
```
(à insérer dans les objets `board.toolbar` et `settings.misc` existants, respectivement)
