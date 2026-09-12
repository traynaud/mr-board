# Design — US-007 Temps depuis Ready

## Référence maquettes

- `docs/design/MR Board - Prototype.dc.html`, script de rendu (fonctions `fmtDays`/`readyColor`, ligne 368-369 ;
  assemblage `readyLabel`/`readyColor`/`openedLabel`, ligne 395-396) et markup de la cellule (ligne 116) :
  `<sc-if value="{{ r.draft }}"><span style="font-size:12px;color:var(--color-neutral-600)">ouverte {{
  r.openedLabel }}</span></sc-if>`
  `<sc-if value="{{ r.notDraft }}"><span style="display:inline-flex;align-items:center;gap:6px;font-weight:600;color:{{
  r.readyColor }}"><i style="width:8px;height:8px;display:block;background:{{ r.readyColor }}"></i>{{ r.readyLabel
  }}</span></sc-if>`
- Wireframes **1a**/**1b** : colonne « Depuis Ready » entre Approved et Ouverte (masquée par défaut), largeur
  118 px.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `MrTableComponent` → nouvelle colonne `ready` rendue par `ReadyDelayComponent` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant | Personnalisation nécessaire |
|---|---|---|
| Carré 8×8 coloré (`<i style="background:{{readyColor}}">`) | `i` custom dans `ReadyDelayComponent` | `width/height: 8px`, `display: block`, couleur via classe (`green`/`orange`/`red`) mappée sur `--color-success`/`--color-warning`/`--color-accent` |
| Libellé Ready (« aujourd'hui »/« N j »), en gras, même couleur que le carré | `span` custom | `font-weight: 600`, `color` identique à celle du carré |
| Libellé draft (« ouverte il y a N j ») | `span` custom, 12px gris | `font-size: 12px; color: var(--color-neutral-600)`, pas de carré |

Aucun composant Angular Material ne couvre ce besoin (élément visuel spécifique, pas un composant d'interaction) —
conforme à la règle « un composant custom n'est écrit que pour les rendus spécifiques du design », même approche
que `DifficultyBadgeComponent` (US-006).

## Éléments visuels spécifiques

### Couleurs
- Vert : `--color-success` (`#2f8f4e`), même token que Easy (US-006) et la coche Approved.
- Orange : `--color-warning` (`#d98a1f`), même token que Medium (US-006).
- Rouge : `--color-accent` (`#ec3013`), même token que Hard (US-006) — cohérence totale des trois niveaux de
  gravité de l'application (difficulté, délai Ready) sur la même palette.
- Draft (gris) : `--color-neutral-600`, même teinte que les tirets « — » et la méta de difficulté.

### Typographie
- Libellé Ready : taille héritée du tableau (13px), **gras** (`font-weight: 600`) — seule cellule en gras du
  tableau hors en-têtes, à respecter précisément (RG-007-02).
- Libellé draft : 12px, poids normal.

### Layout et structure
- `display: inline-flex; align-items: center; gap: 6px` pour aligner carré et libellé sur une seule ligne
  (`white-space: nowrap`), repris à l'identique du prototype (gap 6px, plus serré que les 8px de la difficulté).
- Largeur de colonne 118 px (câblée dans le wireframe, à reprendre dans `mr-table.component.scss` si les largeurs
  de colonnes y sont déjà en dur comme pour les colonnes US-005/US-006).

### États et comportements conditionnels
| État | Condition | Rendu |
|---|---|---|
| Ready, vert | `!draft && readyLevel === 'green'` | Carré + libellé gras verts |
| Ready, orange | `!draft && readyLevel === 'orange'` | Carré + libellé gras oranges |
| Ready, rouge | `!draft && readyLevel === 'red'` | Carré + libellé gras rouges |
| Draft | `draft === true` | Libellé gris seul, pas de carré, pas de tooltip |

### Interactions
- Tooltip au survol (`matTooltip`) uniquement sur la pastille Ready : « Prête depuis le JJ/MM/AAAA HH:mm »
  (RG-007-04). Pas de tooltip sur le libellé draft (absent des maquettes et de la spec).
- Aucune interaction cliquable sur cette cellule dans cette US (le tri par colonne est US-008).

## Assets nécessaires
Aucun nouvel asset ni icône : le carré coloré est un simple élément `<i>` stylé, comme pour la difficulté (US-006).
