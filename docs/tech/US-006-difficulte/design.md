# Design — US-006 Difficulté de la MR

## Référence maquettes

- `docs/design/MR Board - Prototype.dc.html`, script de rendu (fonction `diffOf`, tableau `DIFF`, ligne 111) :
  markup exact de la cellule :
  `<span style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap">`
  `<i style="width:12px;height:12px;display:block;background:{{diffColor}}"></i>`
  `<span>{{diffLabel}}</span>`
  `<span style="font-size:11px;color:var(--color-neutral-600)">{{diffMeta}}</span></span>`
- Wireframes **1a**/**1b** : position de la colonne (entre Titre et 💬), largeur 150 px (héritée de RG-005-02).

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `MrTableComponent` → nouvelle colonne `difficulty` rendue par `DifficultyBadgeComponent` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant | Personnalisation nécessaire |
|---|---|---|
| Carré 12×12 coloré (`<i style="background:{{diffColor}}">`) | `span`/`i` custom dans `DifficultyBadgeComponent` | `width/height: 12px`, `display: block`, couleur via classe (`easy`/`medium`/`hard`) mappée sur `--color-success`/`--color-warning`/`--color-accent` |
| Libellé (« Easy »/« Medium »/« Hard ») | Texte traduit | Aucune mise en forme particulière, hérite de la police du tableau |
| Méta (« 34 f · 1240 l ») | `span` 11px gris | `font-size: 11px; color: var(--color-neutral-600)` (repris tel quel du prototype) |
| État indisponible (« ? ») | `span` custom | Même gabarit visuel qu'un badge normal mais sans carré ni méta, pour ne pas décaler la colonne ; couleur `--color-neutral-600` |

Aucun composant Angular Material ne couvre ce besoin (élément visuel spécifique, pas un composant d'interaction) —
conforme à la règle « un composant custom n'est écrit que pour les rendus spécifiques du design ».

## Éléments visuels spécifiques

### Couleurs
- Easy : `--color-success` (`#2f8f4e`, déjà utilisé pour la coche Approved — cohérence).
- Medium : `--color-warning` (`#d98a1f`, token existant, jusqu'ici inutilisé dans l'application).
- Hard : `--color-accent` (`#ec3013`, couleur de marque déjà omniprésente).
- Indisponible : `--color-neutral-600` (même teinte que les tirets « — » des colonnes Reviewer/Affecté vides,
  cohérence avec l'état "rien à afficher" déjà établi en US-005).

### Typographie
- Libellé : taille héritée du tableau (13px), poids normal (pas de gras, à la différence des en-têtes de colonnes).
- Méta et tooltip : 11px pour la méta (dans la cellule) ; le tooltip lui-même utilise la taille standard des
  tooltips Material, aucune personnalisation.

### Layout et structure
- `display: inline-flex; align-items: center; gap: 8px` pour aligner carré, libellé et méta sur une seule ligne sans
  retour à la ligne (`white-space: nowrap`), repris à l'identique du prototype.
- Largeur de colonne 150 px (RG-005-02, déjà réservée depuis US-005 dans le calcul de la largeur totale du tableau).

### États et comportements conditionnels
| État | Condition | Rendu |
|---|---|---|
| Disponible | `changedFiles !== null` | Carré coloré + libellé + méta, tooltip détaillé |
| Indisponible | `changedFiles === null` | `?` seul, tooltip « Statistiques indisponibles » |

### Interactions
- Tooltip au survol (`matTooltip`), comportement standard Material, cohérent avec le reste du tableau (titre,
  reviewer/affecté).
- Aucune interaction cliquable sur cette cellule dans cette US (le tri par difficulté est US-008).

## Assets nécessaires
Aucun nouvel asset ni icône : le carré coloré est un simple élément `<i>`/`<span>` stylé, pas une icône Lucide.
