# Design — US-027 Favoris

## Référence maquettes

Aucune maquette dédiée dans `docs/design/` (voir specs §4). Référence de style :
`docs/tech/design-system.md` (tokens couleur, accent `#ec3013`) ; le chip reprend le style déjà validé de
Drafts/Mes MRs (US-009, wireframe barre de filtres) ; la colonne étoile s'insère symétriquement à la colonne
menu Colonnes en fin de tableau (wireframe 1a/1b).

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|----------------------|----------------------|
| Barre de filtres | `/` | `FilterBarComponent` (nouveau chip « Favoris ») |
| Tableau des MRs | `/` | `MrTableComponent` (nouvelle colonne étoile) |

## Correspondance maquette → Angular Material

| Élément                          | Composant Material                  | Personnalisation nécessaire |
|-----------------------------------|--------------------------------------|------------------------------|
| Chip « Favoris »                  | `mat-chip-option` (dans le `mat-chip-listbox` existant) | `matChipAvatar` = icône étoile pleine, même style que l'icône `user` du chip « Mes MRs » |
| Bouton étoile (case du tableau)   | `mat-icon-button`                    | Pas de libellé, icône seule (`star`/`star-fill`), `aria-label` dynamique traduit |
| Icône étoile                      | `mat-icon` (SVG Lucide inline)       | Deux variantes à ajouter au registre (`star` contour, `star-fill` plein — voir §Assets) |

## Éléments visuels spécifiques

### Couleurs et thème

- **Étoile non favorite** : contour seul, `color: var(--mat-sys-on-surface-variant)` (même gris neutre que les
  autres icônes secondaires du tableau, ex. `message-square` de la colonne Commentaires) — se fond dans la ligne
  tant qu'elle n'est pas favorite, pour ne pas créer 40 étoiles voyantes par défaut.
- **Étoile favorite** : pleine, `color: var(--color-accent)` (`#ec3013`, cohérent avec la maquette de référence
  citée en specs §4) — identique dans les deux thèmes clair/sombre (l'accent du design system n'est pas
  thème-dépendant ailleurs dans l'app, ex. `.tag-neutral` ne l'est pas non plus).
- **Chip « Favoris »** : mêmes tokens Material que les chips existants (`mat-chip-option` sélectionné/non
  sélectionné) — aucune couleur custom, l'icône `star-fill` du `matChipAvatar` prend `currentColor` du chip
  (comme l'icône `user` du chip Mes MRs), pas l'accent `#ec3013` — pour rester cohérent avec le style neutre des
  deux autres chips (Drafts n'a pas d'icône, Mes MRs a une icône `user` neutre).
- **Focus clavier** : anneau accent standard Material (RG-G — accessibilité), rien de spécifique à styler.

### Typographie

Aucun texte dans la colonne étoile (RG-027-07 : sans en-tête). Le chip « Favoris » reprend la typographie
standard des chips existants (`mat-chip-option`, aucun changement).

### Layout et structure

- **Colonne étoile** : 36px fixe (RG-027-07), premher élément de `displayedColumns`, avant `project`. En-tête
  (`<th>`) vide, sans `appResizableColumn` (ni optionnelle ni redimensionnable, contrairement à `project` et aux
  autres colonnes). Cellule centrée verticalement/horizontalement (`display:flex; align-items:center;
  justify-content:center`), le bouton icône occupe toute la largeur disponible sans déborder sur `project`.
- **Chip « Favoris »** : dans le `mat-chip-listbox` existant, immédiatement après « Mes MRs » (RG-027-10 : « à
  côté de Drafts/Mes MRs ») — ordre : Drafts, Mes MRs, Favoris.
- **Icône étoile** : 18px (cohérent avec les autres icônes de cellule du tableau, ex. `check` de la colonne
  Approved), pas besoin d'agrandir vu le fond neutre de la cellule.

### États et comportements conditionnels

| État | Rendu |
|------|-------|
| MR non favorite | Étoile contour (`star`), gris neutre |
| MR favorite | Étoile pleine (`star-fill`), accent `#ec3013` |
| Survol / focus clavier du bouton | Halo `mat-icon-button` standard (comportement Material par défaut, pas de custom) |
| Échec serveur lors de la bascule (RG-027-09) | Rollback visuel immédiat (l'étoile reprend son état précédent) + toast d'erreur (`MatSnackBar`, même canal que les autres erreurs de la page) |
| Chip « Favoris » actif | `mat-chip-option[selected]` (style Material standard, identique à Drafts/Mes MRs) |
| Chip « Favoris » inactif (défaut) | Non sélectionné, aucun compteur affiché (RG-027-10 : « sans compteur propre ») |

### Interactions et animations

Aucune animation spécifique. Le clic (ou Entrée/Espace, RG-027-08) sur l'étoile bascule **immédiatement**,
sans transition ni confirmation — l'effet visuel du changement d'icône (`star` ↔ `star-fill`) est instantané,
porté par le changement de `[svgIcon]` lui-même (pas de fade/scale ajouté, cohérent avec le reste du tableau qui
n'anime aucune cellule). Le chip suit le comportement standard `mat-chip-listbox` déjà en place pour
Drafts/Mes MRs.

## Assets nécessaires

Deux icônes Lucide à ajouter à `shared/icons/provide-icons.ts` (aucune n'existe encore dans le registre) :

- `star` — contour (`fill="none"`, hérité du gabarit commun), état non favori.
- `star-fill` — même tracé, `fill="currentColor"` posé directement sur l'élément (comme le ferait n'importe quel
  Lucide "filled" variant), état favori. C'est la seule icône du registre à surcharger le `fill="none"` global —
  à documenter d'une ligne de commentaire dans `provide-icons.ts` au moment de l'ajouter.
