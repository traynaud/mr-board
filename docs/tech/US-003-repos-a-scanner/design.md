# Design — US-003 Paramètres : Repos à scanner avec alias

## Référence maquettes
- `docs/design/MR Board - Wireframes.dc.html` — écran **1c**, section `03 · Repos à scanner`
- `docs/design/MR Board - Prototype.dc.html` — vue « Paramètres », tableau des repos, ligne d'ajout
- `docs/design/design-system/styles.css` — règles `.table` (référence visuelle exacte, portée en styles scoped
  plutôt qu'en classe globale, voir ci-dessous)

## Écrans / Vues concernés
| Écran | Route Angular cible | Composant principal |
|-------|-------------------|-------------------|
| Paramètres | `/settings` | `SettingsPageComponent` → `RepositoriesSectionComponent` (section `03`, dernière du formulaire) |

## Correspondance maquette → Angular Material
| Élément de la maquette | Composant Material / custom | Personnalisation nécessaire |
|------------------------|------------------------------|------------------------------|
| Titre `03 · Repos à scanner` + description | `SettingsSectionComponent` (existant) | Réutilisation directe |
| Tableau (Chemin du projet / Alias / ✕) | `<table>` sémantique, styles scoped | Voir « Layout et structure » : réplique fidèle des règles `.table` du design system, sans introduire de classe globale |
| Champ alias inline (ligne existante) | `mat-form-field appearance="outline"` compact | `subscriptSizing="dynamic"` pour ne pas laisser un espace d'erreur vide sous chaque ligne quand elle est valide |
| Bouton supprimer (✕) | `mat-icon-button` + `mat-icon svgIcon="x"` | `aria-label` i18n « Supprimer <alias> » |
| Ligne d'ajout : champ chemin | `mat-form-field appearance="outline"` | Placeholder « groupe/projet ou URL GitLab » |
| Ligne d'ajout : champ alias | `mat-form-field appearance="outline"` | Placeholder « alias » |
| Bouton « Ajouter » | `mat-stroked-button` + icône `plus` | Désactivé si chemin vide ou ajout en cours (RG-003-09) |
| Dialog de suppression | `ConfirmDialogComponent` (US-001) | Nouvelles clés i18n dédiées |
| Toasts « Repo ajouté »/« Repo supprimé » | `MatSnackBar` (déjà stylé `.mrb-toast` depuis US-001) | Réutilisation directe |

## Éléments visuels spécifiques

### Couleurs et thème
- Aucune couleur nouvelle. En-têtes de colonne en majuscules 11 px `--color-neutral-600` (mix 60 % du texte dans la
  réf. design system → approximé avec le token neutre existant, pas de `color-mix` supplémentaire à introduire).
- Erreurs de champ (alias dupliqué/format invalide, chemin introuvable) : `mat-error`, couleur système Material
  (déjà cohérent avec les sections 01/02).

### Typographie
- Table en 14 px (police du corps), cohérent avec le reste de l'écran.

### Layout et structure
- Table pleine largeur (`width: 100%`, `border-collapse: collapse`), répliquée en styles **scoped** au composant
  (comme `.fields` dans les deux autres sections) plutôt qu'en classe globale `.table` — cohérent avec le choix déjà
  fait de ne pas porter l'intégralité du design system dans `styles.scss`, seulement les tokens :
  ```scss
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
       color: var(--color-neutral-600); padding: var(--space-2); border-bottom: 2px solid var(--color-divider); }
  td { padding: var(--space-2); border-bottom: 1px solid var(--color-divider); }
  tbody tr:hover { background: var(--color-neutral-100); }
  ```
- Colonnes : Chemin (flexible), Alias (~150 px), Supprimer (~48 px, centré).
- Ligne d'ajout : dernière ligne du tableau, cellule unique `colspan` contenant un `display:flex` avec les deux
  champs (chemin flexible, alias largeur fixe ~150 px) et le bouton, `gap: var(--space-2)`.
- En dessous de 640 px : la ligne d'ajout passe en colonne (`flex-direction: column`), les champs prennent toute la
  largeur.

### États et comportements conditionnels
| État | Rendu |
|------|-------|
| Chargement de la liste | Texte/`mat-progress-bar` compact scoped à la section (pas le loader pleine page de US-001) |
| Erreur de chargement | Ligne de texte + bouton « Réessayer », scopée à la section |
| Liste vide (aucun repo) | Le tableau n'affiche que l'en-tête + la ligne d'ajout, pas de message spécial (cas normal au premier lancement) |
| Ajout en cours | Bouton « Ajouter » désactivé, pas de libellé changeant (contrairement à « Tester la connexion », l'action est rapide et ne justifie pas un état textuel dédié) |
| Erreur d'ajout — chemin (`projects.notFound`, `projects.alreadyConfigured`) | `mat-error` sous le champ chemin de la ligne d'ajout |
| Erreur d'ajout — alias (`projects.aliasDuplicate`, format) | `mat-error` sous le champ alias de la ligne d'ajout |
| Erreur d'ajout — précondition globale (`settings.tokenMissing`, `gitlab.unavailable`) | Toast (pas un champ précis) |
| Alias existant modifié (non enregistré) | Champ en état Material « dirty » standard, pas de style additionnel ; le bouton « Enregistrer » global s'active |
| Erreur de renommage à l'enregistrement | Toast d'erreur, la valeur saisie dans le champ alias concerné n'est pas perdue |
| Suppression demandée | `ConfirmDialogComponent`, titre « Supprimer ce repo ? », message avec le chemin du repo, actions « Rester » / « Supprimer » |

### Interactions et animations
- Aucune animation spécifique au-delà des transitions Material par défaut (snackbar, dialog).
- Après un ajout réussi, les champs de la ligne d'ajout (chemin, alias) sont vidés et repassent à l'état pristine.

## Assets nécessaires
- Icônes déjà disponibles dans `shared/icons/provide-icons.ts` : `x` (supprimer), `plus` (ajouter). Aucun nouvel
  asset.
