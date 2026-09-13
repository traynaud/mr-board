# Design — US-017 Colonne « Statut »

## Référence maquettes

- Wireframe **1a** (`docs/design/MR Board - Wireframes.dc.html`) — tableau, colonne à insérer entre « Approved » et
  « Depuis Ready ». La colonne « Statut » elle-même **n'existe pas** dans les maquettes (écart documenté dans les
  specs, §4) : conception ci-dessous par extrapolation des patterns existants.
- Prototype (`docs/design/MR Board - Prototype.dc.html`, menu « Colonnes ») — case à cocher « Date d'ouverture » à
  dupliquer pour « Statut ».
- `docs/tech/design-system.md` — icônes Lucide, couleurs `--color-success` / `--color-danger` / `--color-neutral-600`.

## Écrans / Vues concernés

| Écran   | Route Angular cible | Composant principal                                  |
|---------|----------------------|-------------------------------------------------------|
| Tableau | `/`                  | `MrTableComponent` (nouvelle colonne + menu Colonnes) |

## Correspondance maquette → Angular Material

| Élément de la maquette                          | Composant Material              | Personnalisation nécessaire |
|--------------------------------------------------|----------------------------------|------------------------------|
| Coche « Approved » (référence de rendu, RG-005-02) | `mat-icon` seul, sans fond      | Modèle repris pour l'icône de statut, mais **cerclée** (voir ci-dessous) pour ne pas la confondre visuellement avec Approved |
| Case « Date d'ouverture » du menu Colonnes       | `mat-checkbox` + `div[role=checkbox]` (pattern déjà en place) | Dupliqué à l'identique pour « Statut », positionné **avant** |
| Infobulle « +N » des reviewers (RG-G06)          | `matTooltip`                     | Reprend le déclenchement (hover + focus) mais passe en **multi-lignes** (nouveau `tooltipClass`) |

## Éléments visuels spécifiques

### Couleurs et thème

- `mergeable` → icône `circle-check`, couleur `var(--color-success)` (`#2f8f4e`)
- `blocked` → icône `circle-x`, couleur `var(--color-danger)` (= `var(--color-accent)`, `#ec3013`)
- `unknown` → icône `circle-dashed`, couleur `var(--color-neutral-600)`

Ces trois couleurs sont déjà des tokens du design system (aucune nouvelle couleur à définir).

### Typographie

Aucune — cellule 100 % iconographique (comme « Approved »), pas de libellé visible dans la cellule.

### Layout et structure

- Cellule : icône Lucide seule, **18 px**, `stroke-width` **2.2** (légèrement plus épais que les icônes standards à
  2, pour rester lisible à cette taille avec un cercle), alignée à gauche comme les autres cellules (cohérent avec
  RG-017-07).
- Largeur d'en-tête initiale **64 px**, redimensionnable comme les autres colonnes (RG-012-*).
- Position dans `displayedColumns` : entre `approved` et `ready` (voir `archi.md`, section colonnes).
- Menu « Colonnes » : la case « Statut » est ajoutée **avant** « Date d'ouverture », cochée par défaut
  (`mat-checkbox [checked]="showStatus()"`), même structure `.menu-option` (`role="checkbox"`, `tabindex="0"`,
  gestion clavier `Enter`/`Espace`) que l'existant.

### États et comportements conditionnels

| État        | Icône            | Couleur                  | Contenu de l'infobulle (RG-017-08)                                              |
|-------------|------------------|---------------------------|-----------------------------------------------------------------------------------|
| `mergeable` | `circle-check`   | `--color-success`         | « Fusionnable »                                                                   |
| `blocked`   | `circle-x`       | `--color-danger`          | « Non fusionnable : » puis une ligne `– <libellé>` par raison, dans l'ordre RG-017-04 |
| `unknown`   | `circle-dashed`  | `--color-neutral-600`     | « Statut en cours de vérification par GitLab »                                   |

Pas d'état chargement/erreur dédié : `unknown` couvre à la fois « GitLab n'a pas fini d'évaluer » et « MR
synchronisée avant cette US » (RG-017-11) — aucune distinction visuelle entre les deux (même icône, même tooltip).

### Interactions et animations

- Délai d'apparition de l'infobulle : **300 ms** (`[matTooltipShowDelay]="300"`), plus long que le défaut Material
  (0 ms) pour éviter un flash au simple passage de la souris sur le tableau — aligné sur RG-017-08.
- Accessible au clavier : l'icône (ou son conteneur direct) porte `tabindex="0"` — Material déclenche déjà
  l'affichage du tooltip sur `focus` du host, donc aucun handler custom nécessaire au-delà de `tabindex`.
- `aria-label` posé explicitement sur l'icône, égal au texte complet de l'infobulle (raisons concaténées par des
  retours à la ligne réels pour un lecteur d'écran, qui ignore le CSS de mise en forme visuelle).

### Tooltip multi-lignes — personnalisation Material nécessaire

`matTooltip` tronque le texte sur une seule ligne par défaut (`white-space: nowrap` interne au composant Material).
Pour un rendu multi-lignes fidèle à RG-017-08, prévoir un `tooltipClass` dédié appliqué via
`[matTooltipClass]="'mrb-status-tooltip'"`, avec une règle CSS globale (`styles.scss` ou fichier de thème, car
`matTooltip` rend son contenu dans l'overlay Angular CDK, hors de l'arbre du composant — un style scoped au
composant ne l'atteint pas) :

```scss
.mrb-status-tooltip {
  white-space: pre-line;   // respecte les \n du texte assemblé
  max-width: 280px;        // largeur confortable pour ~4-5 raisons
  text-align: left;
}
```

Le texte de l'infobulle est assemblé (voir `archi.md`) avec des `\n` réels entre chaque ligne, jamais du HTML —
`matTooltip` n'interprète pas le HTML.

## Assets nécessaires

- Icônes Lucide (SVG inline, à ajouter à `shared/icons/provide-icons.ts`, mêmes attributs que les icônes existantes
  — `viewBox 0 0 24 24`, `stroke="currentColor"`, `stroke-width="2"`) :
  - `circle-check` : `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`
  - `circle-x` : `<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>`
  - `circle-dashed` : `<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>`

Aucune image bitmap requise.
