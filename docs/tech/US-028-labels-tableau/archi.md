# Architecture — US-028 Labels dans le tableau

## 1. Vue d'ensemble

Aucune migration nécessaire : `merge_requests.labels` (JSON, colonne texte) existe déjà depuis US-004/US-015 et
est déjà parsée côté domaine pour les labels ignorés (`isIgnoredByLabel`). US-028 se limite à :
- exposer ce tableau de chaînes dans le DTO de vue et dans les facettes (nouveau 8ᵉ filtre composable) ;
- l'afficher dans une colonne optionnelle, sur le modèle des colonnes « Statut »/« Date d'ouverture » déjà en
  place (US-011).

Même schéma exact que les filtres multi-sélection existants (`project`/`author`/`assigned`) : `FilterKey`,
`ComposableFilters`, `ALL_FILTER_KEYS`, `matchesLabel`/`buildLabelFacet` côté domaine backend.

## 2. Backend

- `domain/filter-merge-requests.ts` : `FilterableMergeRequest.labels: string[]` ; `matchesLabel()` — sentinelle
  `'none'` (RG-028-13) mirroring la sentinelle existante `'nobody'` de `assigned` ; comparaison exacte, sensible à
  la casse (RG-028-14, pas de normalisation `localeCompare` sur les valeurs elles-mêmes, seulement sur le tri des
  options).
- `domain/build-facets.ts` : `buildLabelFacet()` — labels distincts (`Set`), un label contenant une virgule est
  **exclu des options** (RG-028-15, la valeur ne serait pas représentable dans l'URL `label=<csv>`), tri
  `localeCompare(..., { sensitivity: 'base' })`, option `{ value: 'none', label: 'Sans label', count }` toujours
  en tête — texte non traduit, comme `'Nobody'`/`'Oui'`/`'Non'` déjà en place (dette pré-existante, non corrigée
  ici, hors périmètre de cette US).
- DTOs (`merge-request-view.dto.ts`, `merge-requests-facets.dto.ts`, `merge-request-query.dto.ts`) et
  `merge-requests.controller.ts`/`.service.ts` : ajout mécanique de `labels`/`label` partout où `commented`/
  `assigned` apparaissent déjà, `labels: JSON.parse(mergeRequest.labels) as string[]` dans `toMergeRequestView()`
  (le tableau est déjà stocké en JSON, aucun format nouveau).

## 3. Frontend

### 3.1 Filtre composable « Label »

Positionné en **dernier** dans `ALL_FILTER_KEYS`/l'ordre canonique de décodage URL (specs : « après Commenté »),
à l'inverse de `search` (placé en tête, décision de la bugfix US-026 précédente) — les deux choix découlent
chacun de leur propre spec, pas d'une règle générale d'ordre.

`FilterPillComponent.valueLabel` : les valeurs de label ne passent **jamais** par `computeInitials()` (ce ne sont
pas des noms de personnes) — nouvelle branche `filterKey() === 'label'`, à côté de la branche existante
`value === 'nobody'`.

### 3.2 Colonne « Labels »

`COLUMNS_BEFORE_STATUS` (un seul bloc jusqu'ici) scindé en `COLUMNS_BEFORE_LABELS` (`project, author, title`) et
`COLUMNS_AFTER_LABELS` (`difficulty, comments, reviewer, assignee, approved`), avec le jeton conditionnel
`'labels'` interposé — nécessaire car « Labels » doit être **optionnelle** (comme Statut/Date d'ouverture) tout
en étant positionnée **au milieu** du tableau (RG-028-06), contrairement aux deux autres colonnes optionnelles
qui sont toutes les deux en fin de tableau.

`summarize-labels.ts` (nouvelle fonction pure, testée isolément) : tronque à 2 labels affichés + jeton `+N`,
tooltip listant tous les labels — même principe que les reviewers/assignés multiples, mais factorisé à part
plutôt que dupliqué inline dans le template, car la troncature à 2 est une règle spécifique aux labels
(`VISIBLE_LABELS = 2`, RG-028-07) distincte du seuil utilisateurs.

`ColumnsStore.showLabels`/`toggleLabels()` : même pattern que `showStatus`/`showOpened`, `restore()` étendu à un
3ᵉ paramètre positionnel (`showStatus, showOpened, showLabels`).

### 3.3 URL (`query-params.mapper.ts`)

`OPTIONAL_COLUMN_TOKENS` étendu à `['status', 'opened', 'labels']` — `decodeCols`/`encodeCols` génériques sur ce
tableau, aucune logique conditionnelle nouvelle à écrire pour le 3ᵉ jeton.

## 4. Points d'attention pour la Phase 3 (Dev)

- Ne pas « corriger » les textes de facette non traduits (`'Nobody'`, `'Oui'`/`'Non'`) en ajoutant `'Sans label'` —
  dette pré-existante et volontairement mirroring pour cette US, hors périmètre (RG-028-13 le demande
  explicitement en français).
- `summarizeLabels()` doit rester une fonction pure sans dépendance Angular, testable isolément (cf.
  `is-favorite.ts`/`is-mine.ts` côté backend, même philosophie côté frontend).
