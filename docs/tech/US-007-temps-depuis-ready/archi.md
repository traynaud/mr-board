# Architecture — US-007 Temps depuis Ready

## Résumé fonctionnel
Le backend calcule, à la lecture (`GET /merge-requests`), le délai écoulé depuis que chaque MR est devenue Ready
(jours + niveau vert/orange/rouge) ou, pour un draft, depuis son ouverture ; le frontend affiche ce délai dans une
nouvelle colonne « Depuis Ready » du tableau existant, avec pastille de couleur et tooltip.

---

## Backend

### Impacts sur le modèle de données
Aucun changement de schéma. `merge_requests.ready_at` (`text`, nullable) et `merge_requests.draft` (`boolean`)
existent déjà depuis US-004 et sont déjà correctement maintenus par `resolveReadyAt` (RG-004-04) — US-007 ne fait
que les **lire et les exposer**, calcul compris. `created_at_gitlab` (déjà stocké) sert de date d'ouverture pour le
cas draft (RG-007-05).

- **Entités modifiées** : aucune.
- **Nouvelles entités** : aucune.
- **Migrations** : aucune.

### Intégration dans les modules existants
Tout se passe dans `modules/merge-requests/`, sur le modèle exact d'US-006 (`calculate-difficulty.ts` /
`toDifficultyFields`) :

- **Nouveau** `domain/calculate-ready-delay.ts` — fonctions pures : comptage de jours écoulés (calendaires ou
  ouvrés) et détermination du niveau vert/orange/rouge. Réutilisée à la fois pour le délai Ready et pour
  l'ancienneté d'ouverture d'un draft (RG-007-05), qui n'est qu'un comptage de jours sans niveau.
- **`merge-requests.service.ts`** : `listOpen()` calcule `now` une fois (`new Date().toISOString()`, même
  convention que `sync.service.ts` — pas de `ClockService` dédié dans ce projet) et le propage à
  `toMergeRequestView`, étendu pour calculer les champs Ready (voir Contrat API).
- **`merge-request-view.dto.ts`** : étendu (voir Contrat API).

> ⚠️ Le nom `ready-delay.calculator.ts` figure dans `docs/tech/architecture-backend.md` (§2) mais la convention
> réellement en place dans le code (`resolve-ready-at.ts`, `calculate-difficulty.ts`) est verbe-nom sans suffixe.
> On garde cette dernière : **`calculate-ready-delay.ts`**. À corriger dans `architecture-backend.md` en fin de
> feature (incohérence mineure, sans impact fonctionnel).

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/merge-requests` | — (inchangé) | `MergeRequestViewDto[]` étendu | 200 |

`MergeRequestViewDto` — champs ajoutés :

```ts
class MergeRequestViewDto {
  // ... champs existants (US-005, US-006) ...
  draft!: boolean;
  createdAt!: string;              // ISO ; date d'ouverture, utilisée par le fallback draft (RG-007-05)
  readyAt!: string | null;         // ISO ; null pour un draft
  readyDays!: number | null;       // null pour un draft (RG-007-01)
  readyLevel!: 'green' | 'orange' | 'red' | null; // null pour un draft
  openedDays!: number;             // jours écoulés depuis createdAt ; toujours calculé, consommé par le frontend uniquement quand draft = true
}
```

`calculate-ready-delay.ts` :

```ts
export type ReadyLevel = 'green' | 'orange' | 'red';

export interface ReadyDelayThresholds {
  greenDays: number;
  orangeDays: number;
}

/** Valeurs par défaut de RG-007-03. Remplacées par les seuils utilisateur en US-014. */
export const DEFAULT_READY_DELAY_THRESHOLDS: ReadyDelayThresholds = {
  greenDays: 1,
  orangeDays: 3,
};

/**
 * Jours entiers écoulés entre deux ISO 8601 (RG-G04, `floor`).
 * `workdaysOnly` : ne compte que lundi→vendredi (RG-007-06). Toujours appelé
 * avec `false` tant que US-014 n'introduit pas le réglage en base.
 */
export function calculateElapsedDays(fromIso: string, nowIso: string, workdaysOnly: boolean): number { /* ... */ }

/** RG-007-03 : green si days ≤ greenDays, orange si days ≤ orangeDays, red sinon. */
export function readyLevelForDays(days: number, thresholds: ReadyDelayThresholds): ReadyLevel { /* ... */ }
```

`toMergeRequestView` — algorithme ajouté (RG-007-01, RG-007-05) :
1. `openedDays = calculateElapsedDays(mergeRequest.createdAtGitlab, now, false)` — toujours calculé.
2. Si `mergeRequest.draft` (⟺ `mergeRequest.readyAt === null`, invariant RG-004-04) : `readyAt = readyDays =
   readyLevel = null`.
3. Sinon : `readyDays = calculateElapsedDays(mergeRequest.readyAt, now, false)` ;
   `readyLevel = readyLevelForDays(readyDays, DEFAULT_READY_DELAY_THRESHOLDS)`.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `domain/calculate-ready-delay.ts` (+ `.spec.ts`) | Fonction pure | `calculateElapsedDays` (jours calendaires **et** ouvrés) + `readyLevelForDays`, testés sur les 6 exemples de `specs.md` §5 (niveaux) + le scénario jours ouvrés (vendredi 17h → lundi/mardi) + bornes exactes (0, greenDays, greenDays+1, orangeDays, orangeDays+1) |
| Étendre `dto/merge-request-view.dto.ts` | DTO | Ajout des 5 champs ci-dessus |
| Étendre `merge-requests.service.ts` (`listOpen`, `toMergeRequestView`) (+ `.spec.ts`) | Service | Calcul de `now`, cas draft / non-draft, table de vérité niveaux |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | Champs `draft`/`createdAt`/`readyAt`/`readyDays`/`readyLevel`/`openedDays` dans la réponse pour une MR Ready |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `merge-requests.service.ts` (`listOpen`) | Calcul de `now` partagé pour toutes les lignes de la réponse | Faible | Un seul `new Date().toISOString()` en tête de méthode, passé en paramètre à `toMergeRequestView` — évite un `now` légèrement différent par ligne |
| `merge-request-view.dto.ts` | Ajout additif de 5 champs | Faible | Aucun champ existant modifié |

---

## Frontend

### Intégration dans les features existantes
- `shared/ready-delay/` (déjà prévu dans `architecture-frontend.md`) accueille le nouveau composant, sur le modèle
  exact de `shared/difficulty-badge/`.
- `mr-table.component.ts`/`.html` (US-005/US-006) insère la colonne `ready` après `approved` dans
  `displayedColumns` (ordre du wireframe 1a/1b).
- `models/merge-request.model.ts` étendu avec les 5 nouveaux champs + type `ReadyLevel`.
- `shared/format/format-date.ts` étendu avec une fonction `formatDateTime` (JJ/MM/AAAA HH:mm, heure locale du
  navigateur) pour le tooltip RG-007-04 — `formatShortDate` existant ne gère pas l'heure et ne convertit pas le
  fuseau (parsing texte brut), insuffisant ici.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `matTooltip` | Angular Material | Tooltip « Prête depuis le JJ/MM/AAAA HH:mm » (RG-007-04) sur la pastille Ready uniquement |
| `ReadyDelayComponent` (nouveau) | `shared/ready-delay` | Cellule « Depuis Ready » ; carré coloré + libellé (Ready) ou libellé gris sans pastille (draft) — aucun composant Material ne couvre ce rendu spécifique |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `shared/format/format-date.ts` (+ `.spec.ts`) | Fonction pure | `formatDateTime(iso): string` → `JJ/MM/AAAA HH:mm`, heure locale (`Date` natif, pas `Intl` — cohérent avec `formatShortDate`/`formatThousands`, résultat déterministe) |
| Créer `shared/ready-delay/ready-delay.component.{ts,html,scss,spec.ts}` | Composant | Pastille + libellé si Ready, libellé gris si draft (RG-007-02, RG-007-05) |
| Étendre `models/merge-request.model.ts` | Interface TS | `ReadyLevel`, 5 champs sur `MergeRequestView` |
| Étendre `mr-table.component.{ts,html}` (+ `.spec.ts`) | Composant | Colonne `ready` |
| Ajouter clés `board.mergeRequests.ready.*`, `board.mergeRequests.columns.ready` | i18n | `public/i18n/fr.json` |

#### `ReadyDelayComponent` — détail

- Inputs (reflètent le DTO tel quel, `input.required`, pas de logique de disponibilité dupliquée — RG-006-05
  appliqué au cas Ready/draft) : `draft: boolean`, `readyAt: string | null`, `readyDays: number | null`,
  `readyLevel: ReadyLevel | null`, `openedDays: number`.
- Si `draft()` : `<span class="opened">{{ label() }}</span>` — 12 px gris (`--color-neutral-600`), sans pastille,
  sans tooltip (RG-007-05). `label()` = `board.mergeRequests.ready.openedToday` si `openedDays() === 0`, sinon
  `board.mergeRequests.ready.openedDays` avec `{ days: openedDays() }`.
- Sinon : `<span class="ready" [matTooltip]="tooltip()"><i class="square" [class]="readyLevel()"></i>{{ label()
  }}</span>` — carré 8 px + libellé en gras, même couleur (RG-007-02), couleur via classe (`green`/`orange`/`red`
  → `--color-success`/`--color-warning`/`--color-accent`, mêmes tokens que `DifficultyBadgeComponent`, aucun
  nouveau token). `label()` = `ready.today` si `readyDays() === 0` sinon `ready.days` avec `{ days: readyDays() }`.
  `tooltip()` = `ready.tooltip` avec `{ date: formatDateTime(readyAt()!) }` (RG-007-04).

Clés i18n à ajouter (`public/i18n/fr.json`, section `board.mergeRequests`) :

```json
"columns": { "...": "...", "ready": "Depuis Ready" },
"ready": {
  "today": "aujourd'hui",
  "days": "{{days}} j",
  "tooltip": "Prête depuis le {{date}}",
  "openedToday": "ouverte aujourd'hui",
  "openedDays": "ouverte il y a {{days}} j"
}
```

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `models/merge-request.model.ts` | Ajout de champs à `MergeRequestView` | Faible | Additif, aucun champ existant modifié |
| `mr-table.component.ts`/`.html` (+ `.spec.ts`) | Insertion d'une colonne dans `displayedColumns` | Faible | Même pattern qu'US-006 (colonnes référencées par classe CSS dans les tests, pas par index) |

---

## Points de vigilance globaux

- **⚠️ Point à clarifier — portée réelle du cas draft** : `MergeRequestsService.listOpen()` filtre aujourd'hui
  `where: { draft: false }` (US-005/US-006) : **aucune MR draft n'est actuellement renvoyée par l'API**. RG-007-05
  et son scénario Gherkin restent donc vérifiables en tests unitaires (`calculate-ready-delay.spec.ts`,
  `merge-requests.service.spec.ts` avec une entité `draft: true` construite à la main) et dans
  `ReadyDelayComponent.spec.ts`, mais **ne seront pas visibles dans l'application tant qu'US-009 (chip « Drafts »)
  n'aura pas fait évoluer `listOpen()` pour inclure les drafts sur demande**. Décision retenue : ne pas modifier le
  filtre `draft: false` dans cette US (hors périmètre RG-G10/US-008/US-009 sur l'ordre d'affichage des drafts) —
  US-007 livre le calcul et le rendu, US-009 branchera l'inclusion effective des drafts. À confirmer avec le PO si
  ce séquencement convient.
- **Cohérence des couleurs** : réutiliser exactement `--color-success` / `--color-warning` / `--color-accent`
  (déjà utilisés par `DifficultyBadgeComponent`) — aucune nouvelle variable CSS à introduire.
- **RG-007-07 (rafraîchissement)** : le recalcul au changement de jour (minuit local) n'est pas dans le périmètre
  technique d'US-007 en tant que tel (pas de polling/timer existant avant US-013) — le calcul étant fait à la
  lecture, tout rechargement de la liste (navigation, bouton Rafraîchir, futur polling US-013) suffit à le
  satisfaire. Aucune tâche dédiée nécessaire ici ; à revisiter si le PO exige un timer minuit avant US-013.
- **Fuseau horaire du tooltip** : `formatDateTime` doit utiliser les méthodes locales de `Date` (`getHours()`,
  `getMinutes()`…), jamais UTC, pour respecter « heure locale Europe/Paris » du navigateur de l'utilisateur.

---

## Ordre de réalisation suggéré
1. `domain/calculate-ready-delay.ts` (fonction pure) + tests exhaustifs (niveaux, jours ouvrés, bornes)
2. Extension du DTO + `toMergeRequestView` (+ `now` partagé) + tests unitaires (cas draft/non-draft)
3. Extension de `test/merge-requests.e2e-spec.ts`
4. `shared/format/format-date.ts` : ajout de `formatDateTime` (+ tests)
5. `models/merge-request.model.ts` (frontend)
6. `ReadyDelayComponent` (+ i18n) + tests
7. Intégration dans `mr-table.component` + tests
