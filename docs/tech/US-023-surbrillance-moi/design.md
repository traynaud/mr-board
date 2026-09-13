# Design — US-023 Surbrillance de l'utilisateur dans le tableau

## Référence maquettes

Commit `36cd4b4` (« Prototype et wireframe support github & surbrillance utilisateur ») :
- `docs/design/MR Board - Wireframes.dc.html` — écrans **1a**, **1b** (tableau), **1c**/**2a** (Paramètres, section « Moi »)
- `docs/design/MR Board - Wireframes -sombre-.dc.html` — écrans **1a**, **1b** en thème sombre
- `docs/design/MR Board - Prototype.dc.html` — constante `RING`, fonction `personOf`, case `data-key="highlightMe"`
- `docs/tech/design-system.md` §4 (avatars) — référence des styles Auteur (plein) / Reviewer-Affecté (contour)

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|----------------|----------------------|
| Tableau | `/` | `MrTableComponent` (`features/board/mr-table`), `AvatarComponent` (`shared/avatar`) |
| Paramètres — section Moi | `/settings` | `MeSectionComponent` (`features/settings/sections/me`) |
| Pied de page du tableau | `/` | `BoardPageComponent` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material / existant | Personnalisation nécessaire |
|--------------------------|-------------------------------|-------------------------------|
| Case « Surligner mes MRs… » | `mat-checkbox` | Aucune (même composant que les autres cases de la page Paramètres, ex. `ignoreWip`) |
| Anneau sur avatar | `AvatarComponent` existant | Ajout d'une classe conditionnelle `.highlighted` en CSS pur (`box-shadow`), aucun nouveau composant Material |

## Éléments visuels spécifiques

### Couleurs et thème

- **Anneau** : `box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent);` — deux couches :
  1. un liseré intérieur de 2 px couleur `--color-bg` (« respiration » entre l'avatar et l'anneau, évite que
     l'anneau touche directement le bord de l'avatar) ;
  2. un anneau de 2 px `--color-accent` (`#ec3013`, inchangé entre les thèmes, RG-018-08).
- Fonctionne **sans aucune redéfinition supplémentaire** en thème sombre : `--color-bg` bascule déjà vers `#161514`
  sous `html[data-theme="dark"]` (US-018), ce qui recolore automatiquement le liseré intérieur pour qu'il se
  détache du fond sombre — à vérifier visuellement (aucun token spécifique à créer).
- L'anneau ne doit **jamais** être exprimé en couleur hexadécimale en dur (audit design-system.md §6).

### Typographie

- Aucun changement : ni taille, ni graisse, ni police touchées par cette US.

### Layout et structure

- **Avatar** : 28×28 px inchangé (RG-G12) ; le `box-shadow` ne modifie ni la taille de la boîte ni le flux du
  document (contrairement à une bordure qui s'ajouterait à `box-sizing: border-box`). Aucun changement de largeur
  de colonne.
- **Débordement** : l'anneau déborde de 4 px de chaque côté du carré 28 px (2 px liseré + 2 px anneau). Les
  cellules `td` des colonnes Auteur/Reviewer/Affecté (`mr-table.component.scss`) doivent conserver un padding
  vertical suffisant pour que l'anneau de deux lignes adjacentes ne se touche pas et ne soit pas rogné par un
  éventuel `overflow: hidden` sur la ligne — à vérifier au dev, aucune valeur n'est imposée par la maquette au-delà
  du rendu observé (pas de recouvrement dans le prototype à la hauteur de ligne actuelle).
- **Case « Surligner… »** (section « 01 · Moi ») : occupe toute la largeur de la zone de contenu de la section
  (`grid-column: 1 / -1` si `.fields` est une grille, comme c'est déjà le cas pour d'autres blocs pleine largeur de
  la page Paramètres, ex. bloc « Ignorer les MRs… » de la section Divers), placée **après** le bloc
  `identity-preview` existant, qu'il soit affiché ou non (RG-023-02).

### États et comportements conditionnels

| État | Rendu |
|------|-------|
| `isMe = true`, `highlightMe = true` | Anneau visible autour de l'avatar |
| `isMe = true`, `highlightMe = false` | Avatar normal, aucun anneau |
| `isMe = false` (quel que soit `highlightMe`) | Avatar normal, aucun anneau |
| Ligne draft (opacité réduite, US-009) | L'anneau hérite de l'opacité de la ligne — aucun style spécifique à ajouter, l'opacité s'applique déjà en cascade sur toute la ligne |
| Ligne survolée (`--color-neutral-100`, RG-005-04) | L'anneau reste identique ; le liseré intérieur `--color-bg` ne se confond pas avec le fond de survol car il n'est pas transparent |
| Reviewer/affecté multiple, « moi » pas en première position | L'avatar « moi » est promu en position affichée (celle qui porte l'anneau) ; le badge `+N` et le tooltip restent calculés sur l'ordre GitLab d'origine (aucun changement visuel du badge ou du tooltip lui-même) |
| Identité vide | Aucun `isMe` ne peut être vrai (calcul backend) → aucun anneau, quel que soit `highlightMe` |
| Case « Surligner… » dans les Paramètres | Toujours activable/désactivable, même si l'identité est vide (RG-023-03) — pas d'état désactivé/grisé |

### Interactions et animations

- Aucune animation ni transition n'est prévue par la maquette : l'anneau apparaît/disparaît immédiatement au
  rechargement des données (pas de sur-lecture nécessaire du prototype, qui n'anime pas non plus ce marquage).
- Le clic sur un avatar surligné n'a pas de comportement différent (les avatars ne sont pas cliquables aujourd'hui).
- L'infobulle (`matTooltip`) d'un avatar surligné affiche le nom complet suivi de « (moi) » (RG-023-10) ; celle d'un
  avatar non surligné est inchangée (nom complet seul).

## Assets nécessaires

Aucun nouvel asset (icône, image). L'anneau est un pur effet CSS (`box-shadow`), aucune icône Lucide/SVG requise.
