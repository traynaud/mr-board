# Architecture — US-006 Difficulté de la MR

## Résumé fonctionnel
Le backend calcule la difficulté de relecture de chaque MR à la lecture (`GET /merge-requests`), à partir des
statistiques de diff déjà synchronisées ; le frontend affiche un jeton de couleur avec libellé et détail dans une
nouvelle colonne du tableau existant.

---

## Backend

### Impacts sur le modèle de données

**Entité modifiée** : `MergeRequest` (`modules/merge-requests/entities/merge-request.entity.ts`) — les colonnes
`changed_files`, `additions`, `deletions` passent de `integer NOT NULL` à `integer NULL` (RG-006-02). Justification :
distinguer une MR réellement à 0 fichier modifié d'une MR dont `diffStatsSummary` était absent de la réponse GitLab
au moment de la synchronisation (US-004) — les deux valent aujourd'hui `0` de façon indiscernable.

**Migration** : `1757600400000-AllowNullDiffStats.ts`. SQLite ne supporte pas `ALTER COLUMN` : la migration recrée la
table (`merge_requests_new` avec les 3 colonnes nullables, mêmes contraintes/index que
`1757600300000-CreateMergeRequestsAndSync.ts`), copie les lignes existantes telles quelles (les `0` déjà stockés
restent des `0` — aucune tentative de reconstituer un état antérieur, la distinction ne s'applique qu'aux
synchronisations futures), supprime l'ancienne table, renomme la nouvelle, recrée les 3 index
(`IDX_merge_requests_project_id`, `IDX_merge_requests_ready_at`, `IDX_merge_requests_draft`). `down()` fait l'inverse
en repassant les `NULL` restants à `0` via `COALESCE` pour respecter la contrainte `NOT NULL` réintroduite.

### Intégration dans les modules existants

- **`gitlab/mappers/map-graphql-merge-request.ts`** (US-004) : `MappedGitlabMergeRequest.changedFiles`/`additions`/
  `deletions` passent de `number` à `number | null` ; le mapper renvoie désormais `null` (au lieu de `?? 0`) quand
  `diffStatsSummary` est absent. Les trois champs restent toujours ensemble `null` ou ensemble renseignés (même
  source `diffStatsSummary`) — invariant à documenter en JSDoc, pas à re-vérifier ailleurs.
- **`merge-requests.service.ts`** (US-004/US-005) : `upsertOne` n'a besoin d'aucun changement (assigne déjà
  directement les valeurs mappées à l'entité — les types s'alignent). `toMergeRequestView` (US-005) est étendu pour
  calculer `difficulty`/`changedLines` et propager `changedFiles`/`additions`/`deletions` (voir Contrat API).
- **Nouveau** : `modules/merge-requests/domain/calculate-difficulty.ts` — fonction pure, sur le modèle de
  `resolve-ready-at.ts` (même dossier, même convention de nommage).

### Contrat API

`GET /api/v1/merge-requests` — `MergeRequestViewDto` (US-005) étendu :

```ts
class MergeRequestViewDto {
  // ... champs existants (US-005) ...
  difficulty!: 'easy' | 'medium' | 'hard';
  changedFiles!: number | null;
  additions!: number | null;
  deletions!: number | null;
  /** additions + deletions ; null si l'un des deux est null (RG-006-02). */
  changedLines!: number | null;
}
```

`toMergeRequestView` — algorithme (RG-006-01, RG-006-05) :
1. Si `mergeRequest.changedFiles === null` (donc aussi `additions`/`deletions` null, invariant ci-dessus) :
   `difficulty = 'medium'`, `changedFiles = additions = deletions = changedLines = null`.
2. Sinon : `changedLines = additions + deletions` ; `difficulty = calculateDifficulty(changedFiles, changedLines,
   DEFAULT_DIFFICULTY_THRESHOLDS)`.

`calculate-difficulty.ts` :

```ts
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyThresholds {
  easyFiles: number;
  easyLines: number;
  hardFiles: number;
  hardLines: number;
}

/** Valeurs par défaut de RG-G03. Remplacées par les seuils utilisateur en US-014 (le seul appelant changera). */
export const DEFAULT_DIFFICULTY_THRESHOLDS: DifficultyThresholds = {
  easyFiles: 5,
  easyLines: 100,
  hardFiles: 20,
  hardLines: 800,
};

export function calculateDifficulty(
  files: number,
  lines: number,
  thresholds: DifficultyThresholds,
): Difficulty {
  // easy si files < easyFiles ET lines < easyLines
  // hard si files > hardFiles OU lines > hardLines
  // medium sinon (RG-G03)
}
```

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer migration `1757600400000-AllowNullDiffStats` | Migration | Recrée `merge_requests` avec 3 colonnes nullables (SQLite : pas d'`ALTER COLUMN`) |
| Modifier `entities/merge-request.entity.ts` | Entité TypeORM | `changedFiles`/`additions`/`deletions` → `number \| null`, `nullable: true` |
| Modifier `gitlab/mappers/map-graphql-merge-request.ts` (+ `.spec.ts`) | Fonction pure | `?? 0` → `?? null` sur les 3 champs ; type `MappedGitlabMergeRequest` mis à jour ; renommer le test `should_default_diff_stats_to_zero_when_summary_is_absent` en conséquence |
| Créer `domain/calculate-difficulty.ts` (+ `.spec.ts`) | Fonction pure | Table de vérité RG-G03, testée sur les 9 exemples de `specs.md` §6 + les 4 bornes exactes |
| Créer `dto` : étendre `merge-request-view.dto.ts` | DTO | Ajout des 4 champs |
| Étendre `merge-requests.service.ts` (`toMergeRequestView`) (+ `.spec.ts`) | Service | Algorithme ci-dessus, cas stats disponibles/indisponibles |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | Scénarios "champs API", "stats indisponibles", "vrai zéro" de `specs.md` §6 |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `merge_requests` (table) | Migration recréant la table (3 colonnes nullables) | Moyen (SQLite, pas d'`ALTER COLUMN`) | Suivre exactement le motif recréation-copie-suppression-renommage, réplique des contraintes/index de la migration d'origine ; testé par les e2e existants (`sync.e2e-spec.ts`, `merge-requests.e2e-spec.ts`) qui touchent cette table |
| `MappedGitlabMergeRequest` (type) | 3 champs passent en `number \| null` | Faible | Seul `merge-requests.service.ts` consomme ce type, déjà compatible (assignation directe) |
| `merge-requests.service.spec.ts` (US-004/US-005) | Aucun changement requis a priori | Faible | Vérifier lors du dev que les fixtures existantes (toujours non-null) continuent de passer inchangées |

---

## Frontend

### Intégration dans les features existantes

- `shared/difficulty-badge/` (déjà prévu dans `architecture-frontend.md`) accueille le nouveau composant.
- `mr-table.component.ts`/`.html` (US-005) insère la colonne `difficulty` entre `title` et `comments` dans
  `displayedColumns` (ordre du wireframe, RG-006-03).
- `models/merge-request.model.ts` (US-005) étendu avec les 4 nouveaux champs + type `Difficulty`.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `matTooltip` | Angular Material | Tooltip détaillé (RG-006-04) ou "Statistiques indisponibles" (RG-006-05) |
| `DifficultyBadgeComponent` (nouveau) | `shared/difficulty-badge` | Cellule Difficulté du tableau ; aucun autre composant Material ne convient pour le carré de couleur (élément visuel spécifique au design, cohérent avec la règle "un composant custom n'est écrit que pour les rendus spécifiques du design") |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `shared/format/format-number.ts` (+ `.spec.ts`) | Fonction pure | `formatThousands(n): string` — séparateur espace (« 1 240 »), sur le modèle de `format-date.ts` (implémentation manuelle, pas d'`Intl`, pour un résultat déterministe indépendant de l'ICU du runtime) |
| Créer `shared/difficulty-badge/difficulty-badge.component.{ts,html,scss,spec.ts}` | Composant | Carré coloré + libellé + méta, ou « ? » + tooltip si indisponible |
| Étendre `models/merge-request.model.ts` | Interface TS | `Difficulty`, 4 champs sur `MergeRequestView` |
| Étendre `mr-table.component.{ts,html}` (+ `.spec.ts`) | Composant | Colonne `difficulty` |
| Ajouter clés `board.mergeRequests.difficulty.*`, `board.mergeRequests.columns.difficulty` | i18n | `public/i18n/fr.json` |

#### `DifficultyBadgeComponent` — détail

- Inputs : `difficulty: Difficulty`, `changedFiles: number | null`, `additions: number | null`,
  `deletions: number | null`, `changedLines: number | null` (tous `input.required`, reflètent le DTO tel quel — pas
  de logique de disponibilité dupliquée côté frontend au-delà de tester `changedFiles === null`, RG-006-05).
- `unavailable = computed(() => changedFiles() === null)`.
- Si `unavailable()` : `<span class="badge unavailable" [matTooltip]="...unavailableTooltip">?</span>`.
- Sinon : carré `<i>` coloré via une classe (`easy`/`medium`/`hard`, couleurs par tokens déjà existants —
  `--color-success`, `--color-warning`, `--color-accent`, aucun nouveau token), libellé traduit
  (`board.mergeRequests.difficulty.easy|medium|hard`), méta `{{ changedFiles }} f · {{ changedLines }} l`, tooltip
  détaillé utilisant `formatThousands` sur `changedLines`/`additions`/`deletions`.

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `models/merge-request.model.ts` | Ajout de champs à `MergeRequestView` | Faible | Additif, aucun champ existant modifié |
| `mr-table.component.ts`/`.html` (+ `.spec.ts`) | Insertion d'une colonne dans `displayedColumns` | Faible | Les tests existants de `mr-table.component.spec.ts` référencent les colonnes par classe CSS (`.tag-neutral`, `.title-link`…), pas par index de colonne — pas de rupture attendue, à vérifier au dev |

---

## Points de vigilance globaux

- **Migration SQLite** : à tester explicitement avec des lignes déjà présentes en base avant la migration (les tests
  e2e existants, qui insèrent des MRs via une synchronisation puis relancent d'autres scénarios sur la même base
  applicative, exercent déjà ce chemin — mais vérifier qu'aucune donnée n'est perdue lors de la recréation de table).
- **Invariant "les 3 champs sont ensemble null ou ensemble renseignés"** : vrai tant que le mapper les dérive tous
  les trois de la même source (`diffStatsSummary`). Si une future évolution venait à peupler ces champs
  indépendamment, `toMergeRequestView` devrait être revu (actuellement, ne teste que `changedFiles === null`).
- **Pas de régression sur US-004/US-005** : le changement de nullabilité ne modifie aucun comportement de
  synchronisation observable avec une réponse GitLab réelle (`diffStatsSummary` y est essentiellement toujours
  présent) — seul le cas limite, auparavant silencieusement faussé en `0`, devient correctement représentable.

---

## Ordre de réalisation suggéré

1. Migration `AllowNullDiffStats` + mise à jour de l'entité `MergeRequest`
2. Mise à jour du mapper GraphQL (`?? null`) + son test
3. `domain/calculate-difficulty.ts` (fonction pure) + tests exhaustifs (9 exemples + bornes)
4. Extension du DTO + `toMergeRequestView` + tests unitaires (dont le cas "stats indisponibles")
5. Extension de `test/merge-requests.e2e-spec.ts`
6. `shared/format/format-number.ts` (fonction pure) + tests
7. `models/merge-request.model.ts` (frontend)
8. `DifficultyBadgeComponent` (+ i18n) + tests
9. Intégration dans `mr-table.component` + tests
