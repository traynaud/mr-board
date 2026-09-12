# Architecture — US-013 Actualisation automatique

## Résumé fonctionnel
Le backend synchronise automatiquement les MRs à l'intervalle choisi dans les paramètres (1/5/15/30 min ou manuel),
sans redémarrage à chaud lors d'un changement. Le tableau se recharge déjà automatiquement à la fin de toute
synchronisation (US-005) ; cette US y ajoute l'origine « planifiée ». Le frontend affiche la prochaine échéance et
peut suspendre son polling quand l'onglet est masqué.

---

## Backend

### Impacts sur le modèle de données

**Entité modifiée** : `settings` (`backend/src/modules/settings/entities/settings.entity.ts`)
- `refreshIntervalMin: number` — `int`, défaut `5`, valeurs valides `{0, 1, 5, 15, 30}` (RG-013-01)
- `pauseWhenHidden: boolean` — défaut `true` (RG-013-05) ; **aucune logique backend ne lit ce champ** (RG-013-05 :
  « le backend continue de synchroniser ») — stocké uniquement pour que le frontend le restaure au chargement,
  cohérent avec RG-G18 (tous les paramètres en backend, jamais en `localStorage`, à la différence des largeurs de
  colonnes US-012 qui ne sont pas un « paramètre » au sens Écran Paramètres).

**Migration** : `AddRefreshSettings` (suffixe timestamp, même convention que les migrations existantes du module,
ex. `1757600100000-AddMeIdentity.ts`) — 2 colonnes `NOT NULL DEFAULT`.

### Intégration dans les modules existants

- `SettingsModule` : `SettingsService` gagne un getter étroit `getRefreshIntervalMin(): Promise<number>` (même
  pattern que `getGitlabUrl()`/`getToken()`/`getIdentity()`), `update()`/`toResponse()`/le row par défaut de
  `load()` étendus aux 2 nouveaux champs.
- `SyncModule` : nouveau provider **`SyncScheduler`**, colocalisé avec `SyncService` (pas de nouvelle dépendance
  inter-module — `SyncModule` importe déjà `SettingsModule`, donc `SyncScheduler` peut injecter `SettingsService`
  directement ; l'inverse — `SettingsService` appelant `SyncService` — créerait un cycle `Settings ↔ Sync` et est
  volontairement évité).
- **Nouveau** `domain/compute-next-run-at.ts` — fonction pure, réutilisée par `SyncScheduler` (décider si une
  synchronisation est due) **et** par `SyncService.getStatus()` (calculer `nextRunAt` du DTO) : source unique de
  la règle « prochaine échéance = dernière exécution + intervalle », RG-013-02/03/07.

### Conception du planificateur — écart assumé par rapport à `architecture-backend.md`

`architecture-backend.md` §7 anticipait un `@Interval` **dynamique**, reprogrammé via `SchedulerRegistry` à chaque
sauvegarde des paramètres (ajout/suppression explicite de l'intervalle enregistré). Retenu à la place : un
**tick à cadence fixe et courte** (`SCHEDULER_TICK_MS`, proposé à 15 000 ms) décoré `@Interval()` une seule fois au
bootstrap, qui à chaque passage :
1. lit `refreshIntervalMin` — `0` → ne fait rien (RG-013-01, mode manuel) ;
2. lit le jeton (`SettingsService.getToken()`) — absent → ne fait rien, **sans tracer d'erreur** (RG-013's scénario
   « Sync planifiée sautée sans jeton » — différent du comportement actuel de `SyncService.run()` pour un
   déclenchement `'manual'`, qui trace une ligne `sync_runs` en erreur ; ce comportement existant pour `'manual'`
   n'est pas modifié) ;
3. calcule `computeNextRunAt(refreshIntervalMin, lastRun?.startedAt ?? null, now)` — si `≤ now`, appelle
   `syncService.trigger('scheduled')`.

`SyncService.trigger()` porte déjà le verrou « une seule synchronisation à la fois » (`this.running`, RG-G16) : un
appel `trigger('scheduled')` alors qu'une synchro est en cours (manuelle ou planifiée) est **déjà** un no-op sans
modification — couvre RG-013-02 (« sautée si sync en cours ») sans code supplémentaire. RG-013-03 (« une
synchronisation manuelle réinitialise le compte à rebours ») découle aussi mécaniquement de ce calcul : la
« prochaine échéance » se base sur `lastRun.startedAt` **quel que soit son `trigger`**, donc toute synchronisation
manuelle repousse naturellement la prochaine planifiée.

**Pourquoi ce choix plutôt que `SchedulerRegistry`** : équivalent fonctionnellement (aucun redémarrage requis pour
qu'un changement de `refreshIntervalMin` s'applique — le prochain tick, ≤ 15 s plus tard, relit la valeur à jour),
plus simple à tester (`tick()` appelable directement dans un test unitaire, sans manipuler l'API bas-niveau de
`SchedulerRegistry`), et sans risque de « double intervalle » enregistré en cas d'appels concurrents à une méthode
de reprogrammation.

### ⚠️ Point de vigilance — le planificateur tournerait pendant les tests e2e

`test/utils/create-test-app.ts` boote l'`AppModule` complet (`ScheduleModule.forRoot()` y est déjà enregistré
globalement) : sans garde, `SyncScheduler` s'activerait aussi pendant `npm run test:e2e`, avec un risque réel
d'interférence (un tick planifié pourrait se déclencher pendant la suite `merge-requests.e2e-spec.ts`, qui configure
un vrai jeton + repo et mocke `GitlabClientService`, ajoutant des appels/lignes `sync_runs` non attendus par les
assertions existantes). **Solution retenue** : `tick()` retourne immédiatement si
`process.env.NODE_ENV === 'test'` — Jest positionne cette variable automatiquement (`npm test` et
`npm run test:e2e` sans configuration supplémentaire), donc le planificateur est neutralisé dans toute la suite de
tests sans changer `create-test-app.ts` ni bootstrapper un module différent. `SyncScheduler` reste testé
unitairement en appelant `tick()` **directement** (jamais via un vrai timer), ce garde-fou ne s'appliquant qu'à ce
seul appel direct en test (aucune incidence sur les assertions).

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|---------------|---------|-------|
| PUT | `/api/v1/settings` | `UpdateSettingsDto` + `refreshIntervalMin?: 0\|1\|5\|15\|30`, `pauseWhenHidden?: boolean` | `SettingsResponseDto` (+ 2 champs) | 200, 400 si `refreshIntervalMin` hors énumération (RG-013-01) |
| GET | `/api/v1/settings` | — | `SettingsResponseDto` (+ 2 champs) | 200 |
| GET | `/api/v1/sync/status` | — | `SyncStatusResponseDto` — `nextRunAt` réellement calculé (au lieu de toujours `null`) | 200 |

`SyncStatusResponseDto`/`SyncTrigger('scheduled')` existent déjà tels quels (aucun changement de forme, seulement
de contenu réel — voir specs.md, validation Phase 1).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Migration `AddRefreshSettings` | Migration | 2 colonnes `settings` |
| Étendre `entities/settings.entity.ts` | Entité | `refreshIntervalMin`, `pauseWhenHidden` |
| Étendre `dto/update-settings.dto.ts` | DTO | `@IsIn([0,1,5,15,30])` sur `refreshIntervalMin`, `@IsBoolean()` sur `pauseWhenHidden`, tous deux `@IsOptional()` |
| Étendre `dto/settings-response.dto.ts` | DTO | 2 champs |
| Étendre `settings.service.ts` (+ `.spec.ts`) | Service | `getRefreshIntervalMin()`, `update()`/`toResponse()`/défauts étendus |
| Créer `domain/compute-next-run-at.ts` (+ `.spec.ts`) | Fonction pure | `computeNextRunAt(refreshIntervalMin, lastRunStartedAt, now)` — cas `0` → `null`, jamais synchronisé → `now`, sinon `lastRunStartedAt + refreshIntervalMin` min |
| Créer `sync-scheduler.service.ts` (+ `.spec.ts`) | Service (`@Interval`) | `tick()` : garde `NODE_ENV==='test'`, mode manuel, jeton absent, calcul d'échéance, `trigger('scheduled')` |
| Étendre `sync.service.ts` (+ `.spec.ts`) | Service | `getStatus()` calcule réellement `nextRunAt` via `computeNextRunAt` |
| Étendre `test/settings.e2e-spec.ts` | Test e2e | `PUT` avec les 2 nouveaux champs, 400 sur valeur invalide |
| Étendre `test/sync.e2e-spec.ts` | Test e2e | `GET /sync/status` reflète `nextRunAt` (calculé, pas juste présent) |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `sync.service.ts` (`getStatus`) | `nextRunAt` réellement calculé | Faible | Additif, `null` reste la valeur par défaut sans réglage (mode manuel) |
| `settings.entity.ts`/DTOs | 2 colonnes/champs supplémentaires | Faible | Valeurs par défaut, aucun champ retiré |

---

## Frontend

### Intégration dans les features existantes
- `features/settings/sections/` gagne une 4ᵉ section **`refresh/`** (« 04 · Actualisation ») — le flag `[last]` du
  gabarit `SettingsSectionComponent`, actuellement sur `repositories`, migre vers cette nouvelle section (dernière
  du formulaire).
- `stores/sync.store.ts` expose `nextRunAt` (déjà support-able sans changement de méthode : `loadStatus()`
  recopie simplement un champ de plus depuis la réponse déjà consommée).
- `features/board/board-page.component.ts` orchestre RG-013-05 (pause sur onglet masqué) — nouvelle dépendance à
  `document.visibilitychange`, cohérent avec le principe déjà établi (US-009/010/011) : orchestration multi-store
  au niveau page, `SyncStore` reste sans connaissance de `SettingsStore`.

### Composants réutilisables et Angular Material
| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-radio-group` (première utilisation dans le projet) | Angular Material | Fréquence 1/5/15/30/Manuel (RG-013-06) |
| `mat-slide-toggle` | Angular Material (déjà utilisé pour d'autres bascules paramètres) | « Mettre en pause quand l'onglet est inactif » |
| `matTooltip` | Angular Material (déjà utilisé) | Tooltip « Prochaine synchro à HH:mm » sur le statut de la toolbar |

### Contrat — modèle et mapping

`models/sync-status.model.ts` : `SyncStatus.nextRunAt` et `SyncRun` restent inchangés dans leur usage, mais le
type `nextRunAt: null` (littéral, jamais autre chose jusqu'ici) doit être élargi en `nextRunAt: string | null` —
seul changement de shape nécessaire, aucune restructuration.

`models/settings.model.ts` : `Settings`/`UpdateSettingsRequest` gagnent `refreshIntervalMin: number`,
`pauseWhenHidden: boolean`.

**Nouvelle fonction pure** `features/board/sync-status-label.ts` (extension, pas un nouveau fichier) :
`computeNextRunTooltip(nextRunAt: string | null): { key: string; params?: { time: string } }` — miroir de
`computeSyncStatusLabel` déjà présent dans ce fichier, même testabilité (fonction pure, pas d'accès direct à
`Date.now()`/au DOM). Nécessite un formateur `HH:mm` — nouvelle fonction `formatTime(iso: string): string` dans
`shared/format/format-date.ts` (à côté de `formatShortDate`/`formatDateTime` déjà présents).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Étendre `models/settings.model.ts` | Types | `refreshIntervalMin`, `pauseWhenHidden` |
| Étendre `models/sync-status.model.ts` | Types | `nextRunAt: string \| null` |
| Étendre `shared/format/format-date.ts` (+ `.spec.ts`) | Fonction pure | `formatTime(iso): string` (`HH:mm`, fuseau local) |
| Étendre `features/board/sync-status-label.ts` (+ `.spec.ts`) | Fonction pure | `computeNextRunTooltip(nextRunAt)` |
| Étendre `core/api/settings.service.ts` (+ `.spec.ts`) | Service | Transmission des 2 nouveaux champs (requête/réponse) |
| Étendre `stores/sync.store.ts` (+ `.spec.ts`) | SignalStore | `nextRunAt` dans l'état, recopié par `loadStatus()` |
| Étendre `features/settings/settings-form.ts` (+ `.spec.ts`) | Formulaire | `refreshIntervalMin`, `pauseWhenHidden` dans `SettingsFormControls`/`buildSettingsForm`/`resetSettingsForm`/`toUpdateRequest` |
| Créer `features/settings/sections/refresh/refresh-section.component.{ts,html,scss,spec.ts}` | Composant | `mat-radio-group` (5 options) + `mat-slide-toggle`, reçoit `form: SettingsForm` (même pattern que `me-section`/`gitlab-connection-section`) |
| Étendre `features/settings/settings-page.component.html` | Template | Nouvelle `<app-settings-section number="…04" …><app-refresh-section [form]="form" /></app-settings-section>`, `[last]` déplacé depuis Repos |
| Étendre `features/board/board-toolbar/board-toolbar.component.{ts,html}` (+ `.spec.ts`) | Composant | Nouvel input `nextRunAt`, `[matTooltip]` sur `.sync-label` via `computeNextRunTooltip` |
| Étendre `features/board/board-page.component.ts` (+ `.spec.ts`) | Composant | Écoute `document.visibilitychange` (nettoyée via `destroyRef`) : `hidden` + `pauseWhenHidden` → `syncStore.stopPolling()` ; retour visible → `syncStore.startPolling()` (relit déjà le statut immédiatement, RG-004-08) + `loadMergeRequests()` explicite (RG-013-05, « recharge immédiatement ») |
| Ajouter clés `settings.refresh.*`, `board.sync.nextRunTooltip`, `board.sync.manualTooltip` | i18n | Titre/description section, labels radio, libellé toggle, note explicative, tooltips |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `settings-page.component.html` | Nouvelle section, `[last]` déplacé | Faible | Purement additif + un déplacement de flag |
| `board-toolbar.component.ts`/`.html` | Nouvel input `nextRunAt` (`input.required` ou avec défaut `null`) | Faible | Tous les call sites (dont les tests) doivent le fournir |
| `board-page.component.ts` | Nouveau listener DOM | Faible | Nettoyage via `destroyRef.onDestroy`, même pattern que `syncStore.stopPolling()` existant |

---

## Points de vigilance globaux

- **Planificateur actif en e2e** — voir encadré dédié ci-dessus (garde `NODE_ENV==='test'`).
- **`pauseWhenHidden` avant chargement des settings** : au tout premier rendu, `settingsStore.settings()` est
  `null` — le listener de visibilité ne doit rien faire tant que les settings ne sont pas chargés (défaut `true`
  côté backend, mais le frontend ne le sait pas encore) ; traiter `settings()?.pauseWhenHidden` comme `false`
  (pas de pause) jusqu'au premier chargement plutôt que de risquer une pause non voulue avant que l'utilisateur
  ait vu ses paramètres.
- **`SyncService.trigger()` inchangé** : le comportement existant pour un déclenchement `'manual'` sans jeton
  (trace une ligne `sync_runs` en erreur) n'est pas modifié par cette US — seul `SyncScheduler` applique la
  règle « pas de trace si pas de jeton », propre aux déclenchements silencieux `'scheduled'`.

---

## Ordre de réalisation suggéré
1. Migration + entité `Settings` (+ tests)
2. `domain/compute-next-run-at.ts` (fonction pure) + tests exhaustifs
3. `settings.service.ts` (getter, update, réponse) + tests
4. `sync-scheduler.service.ts` + tests unitaires (`tick()` appelé directement)
5. `sync.service.ts` (`getStatus` avec `nextRunAt` réel) + tests
6. Extension des tests e2e (`settings`, `sync`)
7. Modèles TS frontend + `formatTime` + `computeNextRunTooltip` (+ tests)
8. `settings-form.ts` + `settings.service.ts` (Angular) + `sync.store.ts` (+ tests)
9. `refresh-section.component.*` (+ tests), intégration `settings-page`
10. `board-toolbar.component` (tooltip) + `board-page.component` (visibilité) (+ tests)
11. Clés i18n
12. Validation manuelle contre les maquettes (non réalisable dans cette session, à signaler en QA)
