# Design — US-005 Tableau des MRs (colonnes de base)

## Référence maquettes

- `docs/design/MR Board - Wireframes.dc.html`, vue **1a** (`#1a`) : tableau par défaut. Sert de référence pour les
  colonnes construites par cette US (Projet, Auteur, Titre, 💬, Reviewer, Affecté, Approved) ; les colonnes
  Difficulté, Depuis Ready et Ouverte visibles sur ce même wireframe sont hors périmètre (voir `archi.md`).
- `docs/design/design-system/styles.css` §"tags" (`.tag`, `.tag-neutral`) : source des tokens repris en SCSS
  composant (pas d'import direct de la feuille de référence, convention déjà suivie pour `repos-table` en US-003).

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `BoardPageComponent` → `MrTableComponent` (zone tableau uniquement) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| Tag alias projet (`<span class="tag tag-neutral">api</span>`) | `span` custom (pas de composant Material dédié) | SCSS composant reprenant `.tag`/`.tag-neutral` : `background: var(--color-neutral-100)`, `color: var(--color-neutral-800)`, `padding: 3px 10px`, `font-size: 11px`, **aucun `border-radius`** (`--radius-md` vaut déjà `0px`, donc une valeur littérale `0` explicite plutôt qu'un `calc()` sur le token) |
| Avatar auteur (carré 28 px plein) | `AvatarComponent` `variant="filled"` | Aucune, déjà conforme (US-002) |
| Avatar reviewer/affecté (carré 28 px, bordure) | `AvatarComponent` `variant="outlined"` | Aucune, déjà conforme |
| Titre tronqué + lien | `a` custom + `matTooltip` | `text-overflow: ellipsis; white-space: nowrap; overflow: hidden` sur la cellule ; couleur héritée (`--color-text`), pas de style de lien visité/souligné (cohérent avec le style neutre du wireframe) |
| Icône bulle (en-tête Commentaires) | `mat-icon svgIcon="message-square"` | Taille réduite (14-16 px), `matTooltip="Commentaires"` sur l'en-tête de colonne |
| Coche Approved | `mat-icon svgIcon="check"` | Couleur `var(--color-success)` (`#2f8f4e`) |
| Tableau | `mat-table` | Aucun style de sélection de ligne ; `tr:hover { background: var(--color-neutral-100) }` |
| Barre de progression premier chargement | `mat-progress-bar mode="indeterminate"` | Reprend le style déjà utilisé pour la synchro (US-004), placée au-dessus de la zone tableau |

## Éléments visuels spécifiques

### Couleurs et typographie
- Tag Projet : fond `--color-neutral-100`, texte `--color-neutral-800`, 11px, `letter-spacing: 0.02em` (repris de
  `.tag`/`.tag-neutral` de `design-system/styles.css`).
- Coche Approved : `--color-success` (`#2f8f4e`), seule couleur "métier" de cette US (les couleurs de Difficulté et
  de délai Ready appartiennent à US-006/US-007).
- Titre : police et taille héritées du corps de tableau (13px, cohérent avec `.table td { font-size: 13px }` du
  design system), aucune emphase particulière.

### Layout et structure
- Largeurs de colonnes fixes sauf Titre (`flex: 1 1 auto`), conformément à `RG-005-02`. Largeur totale minimale du
  tableau : 860 px (RG-005-10), avec l'espace excédentaire (du fait des 3 colonnes non construites dans cette US)
  absorbé par la colonne Titre plutôt que retiré — évite un réajustement de mise en page à l'arrivée de US-006/007/012.
- Cellules Reviewer/Affecté : avatar + `+N` sur une seule ligne (`display: flex; align-items: center; gap: 4px`),
  `+N` en 11px `--color-neutral-600`.
- Ligne de tableau : `padding: 6px 8px` par cellule, `vertical-align: middle` (cohérent avec `.table td` du design
  system).

### États et comportements conditionnels
| État | Condition | Rendu |
|---|---|---|
| Premier chargement | `loading && rows.length === 0` | `mat-progress-bar` seule, pas de tableau |
| Rechargement (données déjà présentes) | `loading && rows.length > 0` | Tableau existant inchangé, aucun indicateur visuel superposé (RG-005-05 : pas de flash) |
| Erreur | `loadError` | Toast uniquement (RG-005-07) ; le contenu affiché suit les règles "données existantes" ou "vide" ci-dessus, jamais un état d'erreur bloquant propre à cette zone |
| Vide (repos + jeton configurés, 0 MR) | `!loading && rows.length === 0` | Texte centré « Aucune MR ouverte. », pas de bouton (RG-005-08 — différent du futur état vide "filtres" de US-010, qui aura un bouton "Effacer les filtres") |
| Reviewer/Affecté vide | `summarizeUsers([]).first === null` | `—` (tiret, `--color-neutral-600`), pas d'avatar |
| Avatar sans `avatarUrl` | — | Initiales (déjà géré par `AvatarComponent`, US-002) |

### Interactions
- Survol de ligne : fond `--color-neutral-100`, transition immédiate (pas d'animation, cohérent avec le reste de
  l'application).
- Clic sur le titre : navigation `_self` vers `webUrl`, `rel="noopener"` (RG-005-03) — pas de `preventDefault` ni de
  confirmation.
- Tooltips (auteur, reviewer/affecté, titre, en-tête Commentaires) : `matTooltip` standard, apparition au survol,
  accessibles au clavier via le focus natif du lien/de l'icône porteuse.

## Assets nécessaires
Aucun nouvel asset : `check` et `message-square` sont déjà enregistrées dans `shared/icons/provide-icons.ts` depuis
US-001/US-003.
