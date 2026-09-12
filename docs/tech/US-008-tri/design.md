# Design — US-008 Tri par défaut et tri sur colonnes

## Référence maquettes

- `docs/design/MR Board - Prototype.dc.html` :
  - En-têtes (ligne 90/93) : `<th style="color:{{ diffHeadColor }}" data-act="sort" data-key="diff">Difficulté
    <span style="opacity:.7">{{ diffArrow }}</span></th>` et l'équivalent pour `ready`.
  - Couleurs (ligne 432) : `diffHeadColor: s.sort.key === 'diff' ? 'var(--color-accent)' : 'inherit'`.
  - Flèches (ligne 420) : `arrow = k => s.sort.key === k ? (s.sort.dir === 'asc' ? '↑' : '↓') : '↕'`.
  - Cycle (ligne 323) : clic → `asc` si colonne différente, sinon bascule `asc`↔`desc` (jamais d'état sans tri).
- Wireframe **1a** : en-tête « Depuis Ready ↑ » en accent, « Difficulté ↕ ».

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `MrTableComponent` — en-têtes des colonnes `difficulty` et `ready` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant | Personnalisation nécessaire |
|---|---|---|
| En-tête cliquable avec indicateur `↑`/`↓`/`↕` | `<th mat-header-cell>` custom (pas de `mat-sort-header`) | Voir « Pourquoi pas `mat-sort-header` » ci-dessous |

### Pourquoi pas `mat-sort-header`

Le rendu natif de `mat-sort-header` (Angular Material 21.2.14, module `@angular/material/sort`) est un chevron
animé qui n'apparaît que sur la colonne active (et au survol des autres) — il n'existe pas d'état « toujours visible
à 50 % d'opacité » pour les colonnes triables inactives, ni de glyphe `↑`/`↓`/`↕` littéral. Reproduire fidèlement
RG-008-06 obligerait à masquer l'indicateur natif via `::ng-deep .mat-sort-header-arrow` (interdit sans
documentation explicite — ce qui est fait ici) pour le remplacer entièrement. Décision : en-tête `<th>` cliquable
et activable au clavier, sans `MatSortModule`, cohérent avec `DifficultyBadgeComponent`/`ReadyDelayComponent`
(US-006/007) où un rendu custom a déjà été préféré à un composant Material dont le visuel ne correspondait pas à la
maquette. L'accessibilité (focus, `aria-sort`, activation clavier) est reproduite manuellement (voir États).

## Éléments visuels spécifiques

### Couleurs
- En-tête actif (colonne triée) : `--color-accent` (`#ec3013`), libellé **et** indicateur.
- En-tête inactif : couleur héritée de `th.mat-mdc-header-cell` (`--color-neutral-700`, US-005).
- Indicateur inactif (`↕`) : opacité `0.7` dans le prototype ; RG-008-06 du PO indique `50 %` — **écart mineur
  entre le prototype (0.7) et les specs (0.5)** ; retenir la valeur des specs (`opacity: 0.5`, source de vérité
  fonctionnelle) sauf avis contraire du PO en review.

### Typographie
- Aucune différence de taille/graisse entre en-tête actif et inactif (seule la couleur change) — cohérent avec les
  autres en-têtes du tableau (US-005 : `font-weight: 600` pour tous les `th`).

### Layout et structure
- Indicateur positionné après le libellé, séparé par un espace, sur la même ligne (`display: inline-flex; gap:
  4px`), comme dans le prototype (`<span style="opacity:.7">{{ arrow }}</span>` directement après le texte).
- Largeur de colonne inchangée (US-005/006/007), aucun redimensionnement lié à cette US.

### États et comportements conditionnels
| État | Condition | Rendu |
|---|---|---|
| Triable, inactif | colonne `difficulty`/`ready`, `sort().key !== <cette clé>` | Libellé couleur héritée + `↕` à 50 % d'opacité, `cursor: pointer` |
| Triable, actif ascendant | `sort().key === <cette clé> && sort().direction === 'asc'` | Libellé + `↑` en `--color-accent`, opacité 100 % |
| Triable, actif descendant | `sort().key === <cette clé> && sort().direction === 'desc'` | Libellé + `↓` en `--color-accent`, opacité 100 % |
| Non triable (`project`, `author`, `title`, `comments`, `reviewer`, `assignee`, `approved`) | toute autre colonne | Rendu US-005 inchangé, pas de `cursor: pointer`, pas d'indicateur |

### Interactions et animations
- Clic sur un en-tête triable → `sortChange.emit(key)` (RG-008-03) ; pas d'animation (le tableau se recharge
  entièrement depuis le backend, comme pour un changement de filtre).
- Focus clavier (`tabindex="0"`) + activation par `Enter`/`Espace`, cohérent avec le rôle `button` implicite d'un
  en-tête cliquable (accessibilité, aucune maquette dédiée mais exigence transverse du projet).
- `aria-sort="ascending"`/`"descending"` sur l'en-tête actif, absent sur les autres — pattern standard pour les
  en-têtes de tableau triables (WAI-ARIA `columnheader`).

## Assets nécessaires
Aucun : `↑`, `↓`, `↕` sont des caractères Unicode simples insérés directement dans le template, pas des icônes SVG.
