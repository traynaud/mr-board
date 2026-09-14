# Design — US-025 Couleur d'arrière-plan par repo dans la colonne Projet

## Référence maquettes

Aucune maquette de `docs/design/` ne couvre cette fonctionnalité (voir specs §4). Référence de style :
`docs/tech/design-system.md` (tokens couleur, tag projet actuel `.tag.tag-neutral`) et le tableau des MRs existant
(wireframe 1a/1b, colonne Projet zone 5).

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|----------------------|----------------------|
| Tableau des MRs | `/` | `MrTableComponent` (case Projet) |
| Barre de filtres | `/` | `FilterPillComponent` (menu du filtre « Projet ») |
| Paramètres — Connexions | `/settings` | `RepositoriesSectionComponent` (nouvelle colonne « Couleur ») |

## Correspondance maquette → Angular Material

| Élément                                   | Composant Material           | Personnalisation nécessaire |
|--------------------------------------------|-------------------------------|------------------------------|
| Sélecteur de couleur (fiche repo)          | `mat-menu` + `button`         | Bouton déclencheur = pastille 16×16 zéro arrondi ; menu = grille de 11 pastilles (10 couleurs + « Aucune ») |
| Pastille d'une option du menu de couleur   | `<button>` custom (pas de composant Material dédié à une grille de couleurs) | Carré 16×16, `border: 1px solid var(--color-neutral-400)` pour rester visible même en pastel très clair, coche (`mat-icon svgIcon="check"`) superposée sur l'option sélectionnée |
| Pastille dans l'option du filtre Projet    | `<span>` inline               | Carré 10×10, zéro arrondi, placé avant `option-label` |

## Éléments visuels spécifiques

### Couleurs et thème

Palette fermée (RG-025-02), fond + texte fixes (indépendants du thème clair/sombre) :

| id       | Fond      | Texte     |
|----------|-----------|-----------|
| `slate`  | `#c7d9ea` | `#20303f` |
| `sage`   | `#c8ddc7` | `#25381f` |
| `lilac`  | `#dcd3ea` | `#332a4a` |
| `peach`  | `#f0d9c4` | `#4a2f14` |
| `rose`   | `#f0d3d9` | `#4a1f28` |
| `sand`   | `#ece0c4` | `#43391a` |
| `mint`   | `#c9e5dd` | `#173d31` |
| `steel`  | `#cbd4dc` | `#28333d` |
| `plum`   | `#e3cfe0` | `#3d2038` |
| `olive`  | `#dde0c2` | `#353a17` |

- **Case Projet — Ready** : `background-color: <fond>`, `color: <texte>` (pleine opacité).
- **Case Projet — Draft** : `background-color: rgba(<fond>, 0.45)`, `color: <texte>` (même texte, opacité pleine —
  RG-025-04). Le fond « dilué » compose visuellement avec le fond de la ligne du tableau (`var(--color-bg)` ou la
  surface de ligne alternée, selon le thème actif) — c'est voulu, c'est ce qui produit l'effet « éclairci ».
- **Pastille du filtre Projet** : toujours pleine opacité (RG-025-09 : pas de notion de draft à ce niveau, un repo
  n'est pas lui-même draft).
- **Repo sans couleur** : aucun changement — `.tag.tag-neutral` (fond `var(--color-neutral-100)`, texte
  `var(--color-neutral-800)`), dans les deux contextes (case et filtre).
- **Pastille de sélection (fiche repo)** : bordure `1px solid var(--color-neutral-400)` sur chaque carré de couleur
  (y compris au repos, pas seulement au survol) car certaines teintes (`sand`, `peach`) sont proches de
  `--color-bg` en thème clair et se distingueraient mal sans liseré.

### Typographie

Aucun changement : la case Projet garde la taille/poids de police actuels (`.tag`, 11px, `letter-spacing: 0.02em`).
Seules les couleurs de fond/texte changent.

### Layout et structure

- **Fiche repo (`repositories-section.component.html`)** : nouvelle colonne « Couleur » entre l'alias et le bouton
  de suppression, sur la ligne existante (RG-025-07) et sur la ligne d'ajout. Largeur fixe (~48px), le bouton
  déclencheur affiche uniquement la pastille courante (ou un carré vide/quadrillé pour « Aucune »), sans libellé
  textuel — le nom de la couleur reste disponible via `matTooltip` et l'`aria-label` du bouton.
- **Menu de couleur** : grille CSS `display:grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);` —
  4 colonnes × 3 lignes (10 couleurs + « Aucune » = 11 cases, la dernière case de la grille reste vide). L'option
  « Aucune » est la première de la grille (cohérent avec « Aucune » comme valeur par défaut, RG-025-01).
- **Case Projet du tableau** : structure inchangée (icône de forge optionnelle + alias, RG-021-01), seul le style
  inline de fond/texte du `<span class="tag">` devient conditionnel.
- **Option du filtre Projet** : pastille ajoutée en tout début de ligne, avant la checkbox existante n'est pas
  nécessaire — la placer entre la checkbox et `option-label` (`<span class="option-swatch">`), pour ne pas perturber
  l'alignement de la checkbox avec les autres filtres (auteur, affecté…) qui n'ont pas de pastille.

### États et comportements conditionnels

| État | Rendu |
|------|-------|
| Repo sans couleur, MR Ready ou Draft | `tag-neutral` (inchangé) |
| Repo coloré, MR Ready | Fond plein, texte fixe |
| Repo coloré, MR Draft | Fond à 45 % d'opacité, texte fixe (même couleur que Ready) |
| Menu couleur ouvert, aucune sélection (nouveau repo) | Option « Aucune » cochée par défaut |
| Menu couleur ouvert, couleur existante | Coche sur l'option correspondante |
| Option du filtre Projet, repo sans couleur | Pas de pastille (comportement actuel identique aux autres filtres) |

### Interactions et animations

Aucune animation spécifique — comportement standard de `mat-menu` (déjà utilisé par `FilterPillComponent` et le
menu colonnes du tableau). Le clic sur une pastille sélectionne la couleur et ferme le menu (comme un `mat-menu-item`
classique), sans étape de confirmation supplémentaire — cohérent avec le fait que le changement de couleur d'un
repo existant reste différé au bouton « Enregistrer » global (RG-025-07), donc réversible via « Annuler ».

## Assets nécessaires

- Icône `check` (Lucide, déjà utilisée ailleurs dans l'app si présente dans `assets/icons/`, sinon à ajouter comme
  les autres icônes SVG `svgIcon`) pour marquer la pastille sélectionnée dans le menu de couleur.
- Aucune autre icône : le carré de couleur lui-même est un simple `<span>`/`<button>` avec `background-color` inline,
  pas une image.
