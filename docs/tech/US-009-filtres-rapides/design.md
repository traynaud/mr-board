# Design — US-009 Filtres rapides « Drafts » et « Mes MRs »

## Référence maquettes

- `docs/design/MR Board - Prototype.dc.html`, lignes 56-59 et 82-84 : chips `md-filter-chip` « Drafts »/« Mes MRs »,
  séparateur vertical, compteur + bouton texte « Effacer ». C'est la référence retenue (voir note ci-dessous).
- `docs/design/MR Board - Wireframes.dc.html`, lignes 53-55 et 105-107 : représente « Drafts »/« Mes MRs » comme un
  **segment radio** (« Ready / + Drafts ») et un **bouton** toggle, pas des chips.

⚠️ **Divergence prototype/wireframes** : `specs.md` (RG-009-01/02) tranche explicitement en faveur du prototype en
nommant `mat-chip-option` — décision déjà actée par le PO, non rediscutée ici. Les wireframes restent la référence
pour la disposition générale (position dans la barre, ordre des éléments), pas pour le type de contrôle.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `BoardPageComponent` → nouveau `FilterBarComponent`, au-dessus de `MrTableComponent` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| Chip « Drafts » | `mat-chip-option` dans `mat-chip-listbox multiple` | Aucune — le thème global (`--mat-sys-corner-*: 0px`, palette primary = accent `#ec3013`) s'applique déjà sans `mat.chips-overrides` |
| Chip « Mes MRs » + icône utilisateur | `mat-chip-option` + icône SVG inline (`shared/icons`) | Idem ; `[disabled]` + `matTooltip` quand l'identité n'est pas configurée (RG-009-03) |
| Séparateur vertical | `<span>` stylé (`width:1px;height:24px;background:var(--color-divider)`) | Repris tel quel du prototype, pas de composant Material dédié |
| Compteur « N MRs · M projets » | `<span>` texte, 12px gris | `color: var(--color-neutral-600)`, cohérent avec les autres textes secondaires du tableau |
| Bouton « Effacer » | `mat-button` (text button) | Visible uniquement si « Mes MRs » est actif (RG-009-05) |

Si le rendu par défaut du chip sélectionné (fond/contour) ne correspond pas visuellement à la maquette une fois en
navigateur, utiliser `mat.chips-overrides` (`selected-container-color`, `selected-label-text-color`) — jamais
`::ng-deep` (cohérent avec `docs/tech/design-system.md` §recommandations).

## Éléments visuels spécifiques

### Couleurs
- Chip sélectionné : couleur `primary` du thème (déjà l'accent `#ec3013` via `_theme-colors.scss`, généré depuis
  cette couleur) — aucun nouveau token.
- Compteur : `--color-neutral-600` (cohérent avec les libellés secondaires déjà utilisés : méta de difficulté,
  tirets « — »).
- Séparateur : `var(--color-divider)`.

### Typographie
- Compteur : 12px, poids normal.
- Chips : typographie par défaut de `mat-chip-option` (Archivo hérité du thème global).

### Layout et structure
- Barre : `display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 20px; border-bottom: 2px
  solid var(--color-divider)` — repris du prototype.
- Compteur + « Effacer » alignés à droite (`margin-left: auto` sur leur conteneur, ou un `<span style="flex:1">`
  espaceur comme dans le prototype).
- Position dans `board-page` : juste sous le bandeau « Aucun jeton » (le cas échéant) et au-dessus du tableau ou de
  l'état vide contextuel — visible dès qu'un repo est configuré, y compris quand la liste filtrée est vide (pour
  permettre de désactiver un filtre qui masque tout).

### États et comportements conditionnels
| État | Condition | Rendu |
|---|---|---|
| Drafts masqués (défaut) | `filtersStore.drafts() === false` | Chip non sélectionné |
| Drafts affichés | `filtersStore.drafts() === true` | Chip sélectionné, lignes drafts visibles en bas du tableau |
| Mes MRs inactif (défaut) | `filtersStore.mine() === false` | Chip non sélectionné, actif si identité configurée |
| Mes MRs actif | `filtersStore.mine() === true` | Chip sélectionné, liste filtrée |
| Mes MRs désactivé | identité non configurée (`!identityConfigured`) | Chip `disabled`, tooltip « Configurez votre identité dans les paramètres » (RG-009-03) |
| Bouton Effacer visible | `filtersStore.mine() === true` | Texte « Effacer », clic → `mine` désélectionné, `drafts` inchangé (RG-009-05) |
| Bouton Effacer masqué | `filtersStore.mine() === false` | Absent du DOM (pas seulement caché visuellement) |
| État vide sans filtre actif | 0 MR, `mine === false` | Texte US-005 inchangé (« Aucune MR ouverte. ») |
| État vide avec filtre actif | 0 MR, `mine === true` | « Aucune MR ne correspond aux filtres. » + bouton « Effacer les filtres » |

### Interactions et animations
- Clic sur un chip → toggle immédiat de l'état visuel (signal), requête HTTP debouncée 150 ms (RG-009-07) — pas de
  spinner dédié sur les chips eux-mêmes, le indicateur de chargement du tableau existant (US-005) suffit.
- Chip désactivé : pas de clic possible, tooltip au survol/focus uniquement.

## Assets nécessaires
- Icône utilisateur du chip « Mes MRs » : SVG inline déjà présent dans le prototype (cercle + silhouette), à
  ajouter dans `shared/icons` avec `MatIconRegistry.addSvgIconLiteral` (même mécanisme que `check`/`message-square`
  déjà enregistrés).
