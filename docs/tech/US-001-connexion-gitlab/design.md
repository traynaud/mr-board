# Design — US-001 Paramètres : Connexion GitLab

## Référence maquettes
- `docs/design/MR Board - Wireframes.dc.html` — écran **1c** (Paramètres), en-tête et section `02 · Connexion GitLab`
- `docs/design/MR Board - Prototype.dc.html` — vue « Paramètres » : `md-outlined-text-field` URL / jeton, œil, bouton
  « Tester la connexion », libellés `testLabel` / `testColor`, toast « Paramètres enregistrés »
- `docs/tech/design-system.md` §3 (thème), §4 (page Paramètres, toast)

## Écrans / Vues concernés
| Écran | Route Angular cible | Composant principal |
|-------|-------------------|-------------------|
| Paramètres | `/settings` | `SettingsPageComponent` |

## Correspondance maquette → Angular Material
| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|------------------------|--------------------|-----------------------------|
| En-tête : ← Paramètres … Annuler Enregistrer | `mat-toolbar` (existant) + `mat-button` + `mat-flat-button` | Fond `--color-bg`, règle basse 2 px `--color-divider` (déjà fait) |
| Grille 2 colonnes `200px / 1fr`, gap 32 px | CSS grid dans `SettingsSectionComponent` | Chaque section = 2 cellules avec `padding: 22px 0` et `border-bottom: 2px solid var(--color-divider)` ; la dernière section sans bordure |
| Titre de section `02 · Connexion GitLab` | `<h6>` | `color: var(--color-accent)`, `font: 800 13px var(--font-heading)`, `margin: 0 0 4px` ; description 12 px `--color-neutral-600` |
| Champ « URL de l'instance » | `mat-form-field appearance="outlined"` + `matInput type="url"` | Coins 0 (thème global), largeur 100 % |
| Champ « Jeton d'accès personnel » | `mat-form-field appearance="outlined"` + `matInput [type]="password\|text"` + `matSuffix` `mat-icon-button` | Icône `eye` / `eye-off` (Lucide, `shared/icons`), `aria-label` i18n, `aria-pressed` |
| Indicateur sous le jeton (« Jeton configuré (…wxyz) » / « Aucun jeton ») | `mat-hint` | Texte 12 px `--color-neutral-600` |
| Bouton « Tester la connexion » | `mat-stroked-button` | Pleine ligne (`grid-column: 1 / -1`), suivi du résultat inline |
| Résultat du test | `<span>` + `mat-icon svgIcon="check"` | Succès : `--color-success` ; échec : `--color-accent-700` ; en cours : `--color-neutral-600` (libellé « Connexion… ») |
| Toast | `MatSnackBar` | Fond `--color-neutral-900`, texte blanc 13 px, action « OK » `--color-accent-400`, position bas-gauche (`horizontalPosition: 'start'`), durée 3,5 s |
| Dialog « Abandonner les modifications ? » | `MatDialog` + `ConfirmDialogComponent` | Coins 0, titre `--font-heading`, actions alignées à gauche (« Rester » texte, « Abandonner » flat accent) |
| État chargement | `mat-progress-bar mode="indeterminate"` | 2 px sous l'en-tête, formulaire masqué |
| État erreur de chargement | Bloc texte + `mat-stroked-button` « Réessayer » | Texte `--color-accent-700`, icône `alert-circle` |

## Éléments visuels spécifiques

### Couleurs et thème
- Uniquement des tokens : `--color-accent`, `--color-accent-700`, `--color-success`, `--color-neutral-600/900`,
  `--color-divider`, `--color-bg`. Aucun hex dans les composants.
- Les `mat-form-field` outlined héritent du thème (coins 0, outline `--mat-sys-outline`). Densité `-1` sur la page
  Paramètres pour des champs compacts, via `mat.form-field-density(-1)` scoped à `.settings-page`.

### Typographie
- Archivo partout (héritée). Titres de section 13 px / 800, descriptions 12 px, corps 13 px, hint 12 px.

### Layout et structure
- Conteneur `max-width: 920px`, centré, `padding: 0 16px 40px`.
- `SettingsSectionComponent` rend deux cellules de grille :
  ```
  <div class="section-heading">  ← colonne 1 : <h6>NN · Titre</h6><p>description</p>
  <div class="section-content">  ← colonne 2 : <ng-content>
  ```
  avec `display: contents` sur l'hôte pour que les cellules appartiennent à la grille de la page.
- Section 02 : contenu en grille `1fr 1fr`, gap 16 px ; le bloc test occupe `1 / -1`.
- Largeur ≤ 640 px : grille en une colonne (titre au-dessus du contenu), champs empilés.

### États et comportements conditionnels
| État | Rendu |
|------|-------|
| Chargement initial | Barre de progression, formulaire absent |
| Erreur de chargement | Message + « Réessayer », en-tête sans « Enregistrer » |
| Formulaire pristine / invalide / en cours d'enregistrement | « Enregistrer » désactivé |
| Jeton configuré | Hint « Jeton configuré (…wxyz) », placeholder du champ « Laisser vide pour conserver » |
| Aucun jeton | Hint « Aucun jeton » |
| Test désactivé | URL invalide ou aucun jeton (saisi ou configuré) ou test en cours |
| Test en cours | Bouton désactivé, libellé « Connexion… », résultat gris |
| Test réussi | `✓ Connecté · Marie Dupont (@mdupont) · expire le 12/03/2027` vert ; variante « sans expiration » / « expiration inconnue » |
| Test échoué | `Échec : …` rouge (clé i18n selon `ApiError.code`) |
| Modification après test | Résultat effacé |
| Champ en erreur | Message `mat-error` sous le champ (URL invalide, jeton trop court) |

### Interactions et animations
- Œil : bascule `type` du champ, icône `eye` ↔ `eye-off`, focus conservé dans le champ.
- Enregistrement réussi : toast puis navigation vers `/` (pas de confirmation du guard, formulaire remis `pristine`).
- Annuler / retour / navigation : si `dirty`, dialog ; « Abandonner » navigue, « Rester » ferme.
- Aucune animation spécifique ; les transitions Material par défaut suffisent.

## Assets nécessaires
- Icônes Lucide (`shared/icons/provide-icons.ts`) : `eye`, `eye-off`, `check`, `arrow-left` (présentes) ; ajouter `alert-circle`
  (`<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`).
