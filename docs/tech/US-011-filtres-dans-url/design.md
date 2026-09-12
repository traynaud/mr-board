# Design — US-011 Filtres, tri et colonnes propagés dans l'URL

## Référence maquettes

- `docs/design/MR Board - Prototype.dc.html`, lignes 95-101 : menu « Colonnes » (icône en bout de tableau, item
  unique « Date d'ouverture » à cocher) ; ligne 94 : colonne « Ouverte » conditionnelle ; lignes 124-128 : pied de
  page (légende + query string monospace).
- Wireframes **1a**/**1b** — barre d'URL en haut de wireframe (référence de format, pas un élément à reproduire
  dans l'UI elle-même : la query string affichée à l'écran est dans le pied de page, pas une barre séparée).

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `BoardPageComponent` (pied de page) → `MrTableComponent` (colonne + menu Colonnes) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| Icône « Colonnes » (`md-icon-button`) | `mat-icon-button` | Icône `columns` déjà enregistrée (`shared/icons`) |
| Menu « Colonnes » (`md-menu`) | `mat-menu` | Contenu libre (pas `mat-menu-item`) pour l'item à cocher — même raison qu'en US-010 : doit rester ouvert au clic |
| Case à cocher | `mat-checkbox` | Aucune |
| Pied de page | `<span>` texte, 11px `neutral-600` | Query string en `font-family: ui-monospace, Menlo, monospace` |

### Pourquoi pas `mat-menu-item` pour l'item « Date d'ouverture »

Identique à la décision déjà prise pour les options multi-sélection des pastilles de filtre (US-010,
`filter-pill.component.html`) : un `mat-menu-item` ferme le menu au clic, alors que RG-011-09 exige qu'il reste
ouvert. Même structure de contournement : `<div role="checkbox" tabindex="0" [attr.aria-checked]="…">` avec
gestionnaires `(click)`, `(keydown.enter)`, `(keydown.space)`.

## Éléments visuels spécifiques

### Typographie
- Titre du menu « Colonnes » : identique au style déjà en place pour les titres de menu de pastille (11px,
  majuscules, `letter-spacing: .08em`, `color: var(--color-neutral-600)`, `border-bottom: 1px solid
  var(--color-divider)`).
- Pied de page : 11px, `color: var(--color-neutral-600)` pour les deux zones (légende à gauche, query string à
  droite), query string en police monospace système (`ui-monospace, Menlo, monospace`), comme le prototype.

### Layout et structure
- Pied de page : `display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 20px; padding: 10px 20px
  24px; margin-top: auto` — pousse le pied de page en bas de la colonne flex du contenu du tableau (même comportement
  que le prototype), visible seulement sur l'écran Tableau (pas dans l'état vide « pas de repo »/« pas de jeton » —
  seulement quand `<app-mr-table>` ou l'état vide filtré sont affichés).
- Colonne « Ouverte » : largeur ~120px, alignée comme les autres colonnes de métadonnées (`font-size: 12px; color:
  var(--color-neutral-600)`), positionnée après « Depuis Ready ».
- Colonne `columnsMenu` : largeur ~36px, cellule de données vide (`<td></td>`), seul l'en-tête porte le bouton.

### États et comportements conditionnels

| État | Condition | Rendu |
|---|---|---|
| Colonne « Ouverte » masquée (défaut) | `showOpened() === false` | Colonne absente de `displayedColumns` |
| Colonne « Ouverte » visible | `showOpened() === true` | Colonne insérée entre « Depuis Ready » et le menu Colonnes |
| Case « Date d'ouverture » | reflète `showOpened()` | Cochée/décochée, ne ferme jamais le menu |
| Pied de page | toujours affiché sur l'écran Tableau (hors bandeaux d'état vide sans repo/jeton) | Query string à jour en temps réel (même effet réactif que l'URL du navigateur) |

### Interactions et animations
- Clic sur la case « Date d'ouverture » : bascule immédiatement la colonne, menu reste ouvert (clic extérieur ou
  Échap pour fermer, comportement `mat-menu` par défaut).
- Aucune animation spécifique au-delà du comportement standard de `mat-menu`/`mat-table` déjà en place.

## Assets nécessaires

Aucun nouvel asset — icône `columns` déjà enregistrée dans `shared/icons/provide-icons.ts` mais pas encore
consommée par l'UI ; utilisée ici pour la première fois, pour le bouton « Colonnes » conformément au prototype.
