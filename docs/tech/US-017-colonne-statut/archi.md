# Architecture — US-017 Colonne « Statut » (mergeabilité)

## Résumé fonctionnel
Chaque MR affiche une icône de statut (fusionnable / bloquée / indéterminée) calculée à partir de données de
mergeabilité GitLab récupérées à la synchronisation ; au survol, une infobulle liste les raisons de blocage. La
colonne est optionnelle (menu « Colonnes »), positionnée entre « Approved » et « Depuis Ready ».

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `MergeRequest` (`modules/merge-requests/entities/merge-request.entity.ts`) — 7 colonnes
  ajoutées, **toutes nullable** (RG-017-11, pas de backfill rétroactif) :
  | Colonne (DB)                     | Colonne (entité)             | Type SQLite | Origine GraphQL (RG-017-01)     |
  |-----------------------------------|-------------------------------|-------------|----------------------------------|
  | `detailed_merge_status`           | `detailedMergeStatus`          | text, null  | `detailedMergeStatus`           |
  | `conflicts`                       | `conflicts`                    | boolean, null | `conflicts`                    |
  | `head_pipeline_status`             | `headPipelineStatus`           | text, null  | `headPipeline.status` (`null` si pas de pipeline) |
  | `approvals_required`              | `approvalsRequired`            | integer, null | `approvalsRequired`            |
  | `approvals_left`                  | `approvalsLeft`                | integer, null | `approvalsLeft`                |
  | `resolvable_discussions_count`     | `resolvableDiscussionsCount`   | integer, null | `resolvableDiscussionsCount`   |
  | `resolved_discussions_count`       | `resolvedDiscussionsCount`     | integer, null | `resolvedDiscussionsCount`     |

  `approvalsRequired` est persisté pour information/évolution future mais n'entre dans aucune règle de RG-017-03/04
  (seul `approvalsLeft` compte) — à documenter en JSDoc pour éviter toute confusion en revue.

- **Migration** : `AddMergeStatusFields<timestamp>` (suivre la suite `1757600900000`) — `ALTER TABLE merge_requests
  ADD COLUMN` × 7, toutes nullable, aucun index nécessaire (pas de tri/filtre sur ces colonnes, RG-017-10/QO-017-03).

### Intégration dans les modules existants

- **`modules/gitlab`** :
  - `types/gitlab-merge-request.ts` — étendre `GitlabGraphqlMergeRequestNode` avec `detailedMergeStatus: string`,
    `conflicts: boolean`, `headPipeline: { status: string } | null`, `approvalsRequired: number`,
    `approvalsLeft: number`, `resolvableDiscussionsCount: number`, `resolvedDiscussionsCount: number`.
  - `gitlab-client.service.ts` — ajouter ces 7 champs à `MERGE_REQUESTS_QUERY` (aucun appel GitLab supplémentaire,
    RG-017-01, scénario « Volume d'appels GitLab inchangé »).
  - `mappers/map-graphql-merge-request.ts` — étendre `MappedGitlabMergeRequest` avec les mêmes champs (aplatis :
    `headPipelineStatus: string | null` = `node.headPipeline?.status ?? null`) et `mapGraphqlMergeRequest`.
- **`modules/merge-requests`** :
  - Nouvelle fonction pure `domain/compute-merge-status.ts` (RG-017-02), indépendante de la forge : prend en entrée
    les 6 champs bruts pertinents (`detailedMergeStatus`, `conflicts`, `headPipelineStatus`, `approvalsLeft`,
    `resolvableDiscussionsCount`, `resolvedDiscussionsCount`, tous `| null`) et renvoie `{ state, reasons }` en
    appliquant strictement RG-017-03/04/05 (ordre de `reasons` = ordre du tableau RG-017-04, dédupliqué — chaque
    code n'est ajouté qu'une fois par construction puisque chaque condition correspond à un seul code).
  - `MergeRequestsService.upsertOne` — persiste les 7 nouveaux champs depuis `MappedGitlabMergeRequest`.
  - `MergeRequestsService` (fonctions internes `toMergeRequestView`/nouvelle `toMergeStatusField`) — appelle
    `computeMergeStatus` avec les colonnes de l'entité et assemble `MergeRequestViewDto.mergeStatus`. Suit le même
    pattern que `toDifficultyFields`/`toReadyFields` (fonction top-level, pas de méthode privée de service).
- **`modules/sync`** : aucun changement — `SyncService.syncProject` passe déjà `mapped` (issu de
  `mapGraphqlMergeRequest`) tel quel à `upsertForProject` ; les nouveaux champs suivent le flux existant sans
  modification de `sync.service.ts`.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/merge-requests` | *(inchangé)* | `MergeRequestsResponseDto` — `mergeRequests[].mergeStatus` ajouté | 200 |

`mergeStatus` : `{ state: 'mergeable' | 'blocked' | 'unknown', reasons: { code: MergeStatusReasonCode; count?:
number }[] }` (RG-017-06). Aucun texte traduit côté backend ; `count` uniquement sur `not_approved` et
`discussions_unresolved`.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `domain/compute-merge-status.ts` | Fonction pure | Calcule `{ state, reasons }` (RG-017-03/04/05) |
| Créer `domain/compute-merge-status.spec.ts` | Test unitaire | Couvre chaque code de raison, cumul, ordre, dédup, drafts, `unknown`, valeur inconnue (RG-017-07 scénarios) |
| Créer migration `AddMergeStatusFields<ts>` | Migration | 7 colonnes nullables sur `merge_requests` |
| Créer `dto/merge-status.dto.ts` (ou classes internes à `merge-request-view.dto.ts`) | DTO | `MergeStatusReasonDto`, type `MergeStatusState` |
| Étendre `entities/merge-request.entity.ts` | Entité | 7 colonnes nullables |
| Étendre `types/gitlab-merge-request.ts` | Type | Champs GraphQL bruts |
| Étendre `gitlab-client.service.ts` (`MERGE_REQUESTS_QUERY`) | Requête GraphQL | Ajout des 7 champs |
| Étendre `mappers/map-graphql-merge-request.ts` | Mapper | Champs mappés + test associé |
| Étendre `merge-requests.service.ts` (`upsertOne`, `toMergeRequestView`) | Service | Persistance + assemblage `mergeStatus` |
| Étendre `merge-request-view.dto.ts` | DTO | Champ `mergeStatus` |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | Vérifie la présence de `mergeStatus` dans la réponse, cas `unknown` sur MR sans données |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `merge-request.entity.ts` | 7 colonnes nullables ajoutées | Faible | Toutes nullable, cohérent avec le pattern déjà utilisé pour `changedFiles`/`additions`/`deletions` (`AllowNullDiffStats`) |
| `map-graphql-merge-request.spec.ts` / `gitlab-client.service.spec.ts` | Les fixtures `graphqlNode()`/nœuds de test n'incluent pas les nouveaux champs obligatoires du type GraphQL | Moyen | Ajouter les 7 champs aux builders de fixtures existants (valeurs par défaut `MERGEABLE`/`false`/`null`/`0`) pour ne pas casser la compilation TypeScript des tests |
| `merge-requests.service.spec.ts` | Fixtures de `MergeRequest` sans les nouveaux champs | Moyen | Ajouter les 7 champs (souvent `null`) aux builders d'entité de test ; vérifier `mergeStatus: { state: 'unknown', reasons: [] }` pour une MR sans données (RG-017-11) |
| `merge-requests.controller.spec.ts` | Assertions sur la forme de `MergeRequestViewDto` | Faible | Mettre à jour les fixtures attendues si elles listent les champs explicitement |

---

## Frontend

### Intégration dans les features existantes

- Feature `features/board` : nouvelle colonne dans `mr-table` (`MrTableComponent`), nouvelle case dans le menu
  « Colonnes », état de visibilité dans `ColumnsStore`, décodage/encodage d'URL dans `query-params.mapper.ts`.
  Aucune nouvelle route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatIcon` (`svgIcon`) | Angular Material | Icônes `circle-check`/`circle-x`/`circle-dashed` (nouvelles, Lucide) |
| `MatTooltipModule` | Angular Material | Infobulle multi-lignes (RG-017-08) |
| `MatCheckboxModule` / pattern `menu-option` existant | Déjà utilisé pour « Date d'ouverture » | Nouvelle case « Statut » dans le même menu |
| Pattern `DifficultyBadgeComponent` (composant standalone + `computed()` + `TranslateService` injecté) | `shared/difficulty-badge` | Modèle repris pour le nouveau composant `MergeStatusIconComponent` |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Ajouter `circle-check`, `circle-x`, `circle-dashed` | Icônes | `shared/icons/provide-icons.ts`, tracés Lucide standards |
| Créer `shared/merge-status-icon/merge-status-icon.component.ts` (+ `.html`, `.scss`, `.spec.ts`) | Composant | Icône cerclée colorée + tooltip multi-lignes + `aria-label`, reçoit `mergeStatus: MergeStatus` en `input.required` (voir `design.md`) |
| Étendre `models/merge-request.model.ts` | Interface TS | `MergeStatusState`, `MergeStatusReasonCode` (11 valeurs RG-017-04 + `other`), `MergeStatusReason`, `MergeStatus`, champ `mergeStatus` sur `MergeRequestView` |
| Étendre `stores/columns.store.ts` | SignalStore | État `showStatus` (défaut `true`), méthode `toggleStatus()`, `restore(showStatus, showOpened)` |
| Étendre `stores/column-widths.store.ts` | SignalStore | `ResizableColumnKey` += `'status'`, `DEFAULT_COLUMN_WIDTHS.status = 64` |
| Étendre `core/url-state/query-params.mapper.ts` | Mapping URL | Nouvelle sémantique de `cols` (RG-017-09, voir ci-dessous) |
| Étendre `mr-table.component.ts` / `.html` | Composant | Colonne `status` conditionnelle entre `approved` et `ready`, nouvelle case menu, nouveaux inputs/outputs |
| Ajouter clés `board.mergeRequests.mergeStatus.*`, `board.columns.status` | i18n | `public/i18n/fr.json` |
| Étendre `board-page.component.ts` | Composant | `restoreFromUrl` passe `showStatus` à `columnsStore.restore`, nouvel handler `onToggleStatusColumn()` |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `stores/columns.store.ts` | `restore(showOpened)` devient `restore(showStatus, showOpened)` | Faible | Mettre à jour le seul appelant (`board-page.component.ts`) et les tests du store |
| `core/url-state/query-params.mapper.ts` (`decodeCols`/`encodeQueryParams`) | Sémantique de `cols` change : liste positive au lieu d'un simple booléen `opened` | Moyen | Voir logique détaillée ci-dessous ; les specs (RG-017-09) et les scénarios Gherkin fixent précisément le contrat — à utiliser comme cas de test |
| `mr-table.component.ts` (`BASE_COLUMNS`, `displayedColumns`) | La colonne `status` est optionnelle **et** positionnée au milieu (contrairement à `opened`, ajoutée en fin) | Moyen | Scinder les colonnes fixes en deux groupes (avant/après `status`) : `[...avant, ...(showStatus() ? ['status'] : []), 'ready', ...(showOpened() ? ['opened'] : []), 'columnsMenu']` |
| `mr-table.component.html` (menu Colonnes) | Ajout d'une 2ᵉ case, avant « Date d'ouverture » (RG-017-09) | Faible | Dupliquer le bloc `.menu-option` existant |
| `board-page.component.ts` (`currentQueryParams`, `restoreFromUrl`) | Ajout de `showStatus` | Faible | Un point d'entrée unique déjà centralisé (`encodeQueryParams`/`decodeQueryParams`) |

#### Détail — sémantique de `cols` (RG-017-09)

```
decodeCols(raw):
  colonnes optionnelles = { status: true par défaut, opened: false par défaut }
  si raw absent           → défauts (status=true, opened=false)
  si raw === 'none'       → status=false, opened=false
  sinon                   → pour chaque token de raw.split(','), si token === 'status' → status=true ;
                             si token === 'opened' → opened=true ; sinon ignoré (valeur inconnue, RG-017-09).
                             Les colonnes non listées dans les tokens reconnus restent à leur valeur *masquée*
                             (pas défaut) dès que `raw` est présent et non vide de tokens reconnus.
```

⚠️ Point à clarifier avec le scénario « Afficher Ouverte en gardant Statut » : partant de l'état par défaut
(`status` visible, `opened` masqué, pas de `cols` dans l'URL) et cochant « Date d'ouverture », le résultat attendu
est `cols=status,opened` — donc l'**encodage** doit toujours écrire la liste complète des colonnes optionnelles
visibles dès qu'au moins une n'est pas dans son état par défaut, plutôt que de chercher à minimiser. Règle
d'encodage retenue :
```
encodeCols(showStatus, showOpened):
  si showStatus === true et showOpened === false  → ne pas écrire `cols` (état par défaut, RG-017-09)
  sinon si showStatus === false et showOpened === false → 'none'
  sinon → liste, dans l'ordre ['status','opened'], des colonnes visibles parmi les deux
          (ex : showStatus=true, showOpened=true → 'status,opened' ; showStatus=false, showOpened=true → 'opened')
```

---

## Points de vigilance globaux

- **Tooltip multi-lignes** : `matTooltip` de Material n'autorise pas nativement le multi-ligne (troncature par
  défaut). Nécessite un `tooltipClass` dédié avec `white-space: pre-line` et `max-width` élargi (voir `design.md`).
- **`aria-label` explicite** (RG-017-08) : ne pas se reposer uniquement sur `aria-describedby` généré par
  `matTooltip` — poser `[attr.aria-label]` directement sur l'icône/son conteneur, et `tabindex="0"` pour le focus
  clavier (Material déclenche déjà le tooltip au focus du host).
- **Fixtures de test backend cassées par les nouveaux champs obligatoires du type GraphQL** : `gitlab-client.service.spec.ts`
  et `map-graphql-merge-request.spec.ts` construisent des nœuds `GitlabGraphqlMergeRequestNode` complets — à mettre à
  jour en priorité pour ne pas bloquer la compilation TypeScript avant même d'écrire le nouveau code.
  Voir aussi `merge-requests.service.spec.ts` pour les fixtures d'entité.
  **Attention à ne pas modifier `graphqlNode()` avec des valeurs qui changeraient le comportement des tests
  existants** : neutraliser via des valeurs qui ne déclenchent aucune raison de blocage (`MERGEABLE`, `false`,
  `null`, `0`).
- **`approvalsRequired` non utilisé dans le calcul** : à documenter clairement (JSDoc) pour éviter qu'un futur
  correctif imagine une règle basée dessus (seul `approvalsLeft` compte, RG-017-04 ligne 6).
- **Rétrocompatibilité `ColumnsStore`** : `restore()` change de signature (2 paramètres au lieu d'1) ; un seul
  appelant (`board-page.component.ts`) donc risque limité, mais à vérifier dans les specs des tests existants.
- **Cohérence avec l'épique multi-forges (US-020)** : les codes de `MergeStatusReasonCode` sont volontairement
  génériques (RG-017-02) — ne pas introduire de terme spécifique GitLab dans les noms de code exposés par l'API.

---

## Ordre de réalisation suggéré

1. Migration TypeORM (7 colonnes nullables) + mise à jour de l'entité `MergeRequest`
2. Types GraphQL + `MERGE_REQUESTS_QUERY` + mapper (`map-graphql-merge-request.ts`) + mise à jour des fixtures de test existantes cassées par les nouveaux champs obligatoires
3. `domain/compute-merge-status.ts` + tests unitaires exhaustifs (tous les scénarios Gherkin de la spec)
4. `MergeRequestsService` (persistance + assemblage `mergeStatus`) + DTOs + tests unitaires/e2e
5. Modèles TS frontend (`MergeStatus*`) + i18n (`fr.json`)
6. `ColumnsStore` (`showStatus`) + `ColumnWidthsStore` (`status`) + `query-params.mapper.ts` (nouvelle sémantique `cols`) + tests
7. `MergeStatusIconComponent` (icônes Lucide ajoutées) + tests
8. `MrTableComponent` (colonne + menu) + `BoardPageComponent` (câblage) + tests
9. Validation manuelle contre les scénarios Gherkin de la spec et le wireframe 1a
