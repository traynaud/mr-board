# Design — US-012 Colonnes redimensionnables

## Référence maquettes

- Wireframe **1a**, note de pied : poignées de redimensionnement sur chaque séparateur d'en-tête, style `th::after`
  (trait 1 px, `cursor: col-resize`).
- Prototype : ne modélise pas le redimensionnement (hors périmètre du prototype de référence) — comportement
  interprété depuis RG-012-01/02/04/07/08.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `MrTableComponent` (poignées + menu Colonnes étendu) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| Poignée de redimensionnement | Aucun (pas d'équivalent Material) | `<span appResizableColumn>` custom, positionné en absolu sur le bord droit du `<th>` |
| Séparateur avant « Réinitialiser » | `mat-divider` | Aucune |
| Item « Réinitialiser les largeurs » | `mat-menu-item` | Aucune (item standard, ferme le menu) |

## Éléments visuels spécifiques

### Couleurs
- Trait de poignée au repos : invisible (`opacity: 0`).
- Trait de poignée visible au survol de l'en-tête : `var(--color-divider)` (RG-012-01).
- Trait de poignée au focus clavier (pendant l'ajustement) : `var(--color-accent)`, cohérent avec le ring de focus
  déjà utilisé ailleurs dans l'app (`docs/tech/design-system.md`, focus 2px accent).

### Layout et structure
- `<th>` redimensionnable : `position: relative`, largeur explicite (`[style.width.px]`).
- Poignée : `position: absolute; top: 0; right: -3px; width: 6px; height: 100%; cursor: col-resize; touch-action:
  none` — zone de préhension de 6px centrée sur le bord droit du `<th>` (RG-012-01), `touch-action: none` pour ne
  pas déclencher de gestes de défilement tactile pendant le glisser.
- `.mr-table { table-layout: fixed }` — nécessaire pour que les largeurs posées sur les en-têtes soient respectées
  strictement (au lieu d'un ajustement automatique au contenu) ; la colonne « Titre » reste sans largeur explicite
  et absorbe donc tout l'espace restant (RG-012-02), sans changement de markup pour cette colonne.

### États et comportements conditionnels

| État | Condition | Rendu |
|---|---|---|
| Poignée au repos | — | Invisible, curseur `col-resize` sur toute la zone de 6px |
| Poignée visible | survol de l'en-tête (`th:hover`) | Trait 1px `--color-divider` |
| Poignée en cours de glisser | `pointerdown` actif | Largeur de la colonne mise à jour en temps réel (RG-012-01) |
| Poignée focalisée (clavier) | `:focus-visible` | Trait 1px `--color-accent` |
| Largeur en butée | `< 40px` ou `> 800px` | Le glisser/la flèche n'a plus d'effet au-delà de la borne (RG-012-02) |
| Menu Colonnes | inchangé (US-011) + nouvel item | Case « Date d'ouverture » (US-011), séparateur, « Réinitialiser les largeurs » |

### Interactions et animations
- Glisser : suit le pointeur en continu, aucun snapping.
- Double-clic sur une poignée : la colonne revient instantanément à sa largeur par défaut (RG-012-04), sans
  animation de transition (cohérent avec le reste de l'app, pas de micro-animations sur les changements de layout).
- Clic simple sur la poignée (sans glisser) : aucun effet, ne déclenche pas le tri même sur une colonne triable
  (RG-012-08).
- Clavier : poignée focalisable (`tabindex="0"`), flèche gauche/droite = ±8px (RG-012-07).

## Assets nécessaires

Aucun nouvel asset.
