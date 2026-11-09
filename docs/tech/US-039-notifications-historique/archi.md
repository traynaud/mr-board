# Architecture — US-039 → US-042 Notifications de l'historique

## Résumé fonctionnel
> Un panneau et un compteur (cloche de la toolbar) présentent les événements d'historique que l'utilisateur n'a pas
> encore « marqués comme vus », filtrés par type et par périmètre (réglages). Les Paramètres passent en 4 onglets.

Specs : `docs/features/US-039-notifications-historique/specs.md` — Design validé : `design.md`, `mockup.html`.

**Principe directeur** : pas de second journal. Une notification est une ligne de `merge_request_events` avec un
marqueur « vu » nullable. Tout l'existant (provisoire → confirmé en place, purge par rétention, suppression d'un
provisoire sans correspondance) donne gratuitement RG-039-05/06 et RG-040-06 : le patch de `reconcileEvents`
(`EventUpdate`) ne touche ni `dismissedAt` ni l'id, et la rétention supprime la ligne.

---

## Backend

### Impacts sur le modèle de données

- **`MergeRequestEvent`** (`history/entities/merge-request-event.entity.ts`) : + `dismissedAt: string | null`
  (`dismissed_at`, text ISO nullable, **indexé** `(dismissed_at, occurred_at)`). `null` = à traiter.
- **`Settings`** (`settings/entities/settings.entity.ts`) : + 3 colonnes additives avec défaut :
  - `notif_disabled_types` text JSON `HistoryEventType[]`, défaut `'[]'` (on stocke les types **désactivés** : un
    type ajouté plus tard est activé d'office, RG-041-02) ;
  - `notif_only_mine` boolean, défaut `0` ; `notif_exclude_own` boolean, défaut `0` (RG-041-06).
- **Nouvelle entité** : aucune.
- **Migration** `1757602500000-AddNotifications.ts` :
  1. `ALTER TABLE merge_request_events ADD COLUMN dismissed_at text NULL` ;
  2. `UPDATE merge_request_events SET dismissed_at = <now>` (RG-039-02 : l'historique existant est fermé d'office) ;
  3. `CREATE INDEX IDX_events_dismissed ON merge_request_events (dismissed_at, occurred_at)` ;
  4. `ALTER TABLE settings ADD COLUMN …` ×3 avec défaut.
  `down()` : retire l'index et les colonnes (SQLite : reconstruction de table, comme `AllowNullDiffStats`).
  Pas de perte de données : le `UPDATE` est borné aux lignes existantes, colonnes toutes nullables ou avec défaut.
- **Création d'événements** : toutes les insertions existantes (`history.service.ts`, `history-enrichment.service.ts`
  inserts + `terminal`) laissent `dismissed_at = NULL` par défaut → naissent « à traiter ». Aucun changement de code.

### Périmètre « Seulement mes MRs » — option A retenue (arbitrage D3)

Une MR fusionnée ou fermée **quitte** `merge_requests` (RG-G01) : un `JOIN` sur les relations
auteur / reviewers / assignees ne retrouve plus ses événements terminaux (fusion, fermeture, disparition), alors
que ce sont les plus utiles à notifier. Il faut donc figer « qui est concerné » **au moment de l'événement**.
Décision : colonne `mr_involved_usernames` (text JSON, nullable) sur `merge_request_events` = usernames
(auteur + reviewers + affectés) au moment de la détection ; `null` pour les événements antérieurs (jamais « à moi »,
déjà fermés par la migration de toute façon).

### Intégration dans les modules existants

- **Nouveau module `modules/notifications/`** (feature-first, importe `HistoryModule`, `SettingsModule`,
  `ConnectionsModule`) : `notifications.module.ts`, `notifications.controller.ts`, `notifications.service.ts`,
  `domain/notification-filter.ts` (fonctions pures), `dto/*`, `*.spec.ts`.
  Il lit/écrit `MergeRequestEvent` via `@InjectRepository` (exporté par `HistoryModule`) ; `history/` n'a pas de
  dépendance retour.
- **`SettingsService` / DTOs** : exposer les 3 réglages (`settings-response.dto.ts`, `update-settings.dto.ts` avec
  `@IsIn` sur les 18 types, `@IsBoolean`).
- **`SettingsTransferService`** : export / import des 3 réglages ; clés absentes → défauts (RG-041-04).
- **`HistoryRetentionService`** : inchangé (la suppression emporte la notification).
- **`HistoryService.recordProjectChanges` / enrichment** : renseigner `mr_involved_usernames` à l'insertion.
- **Identité « moi »** : `connections.resolved_username` par connexion (US-031) — c'est elle qui sert à « mes MRs »
  et « mes propres actions », par `connection_id` de l'événement.

### Fonctions pures (`notifications/domain/notification-filter.ts`)

`isEligible(event, prefs, meByConnection)` : type non désactivé ∧ (¬excludeOwn ∨ acteur ≠ moi ; un acteur `null`
n'est jamais exclu, RG-041-06) ∧ (¬onlyMine ∨ moi ∈ `involvedUsernames`). Une version SQL équivalente est produite
par un `QueryBuilder` (même règle, testée par un test de parité) pour que `count` et la pagination restent exacts
au-delà de 50.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/notifications` | `limit` (1–50, défaut 50) | `{ events: HistoryEventDto[], count: number, revision: string }` | 200 |
| GET | `/api/v1/notifications/summary` | — | `{ count: number, revision: string }` | 200 |
| POST | `/api/v1/notifications/:id/dismiss` | — | — | 204, 404 |
| POST | `/api/v1/notifications/dismiss-all` | — | `{ dismissed: number }` | 200 |

- `events` réutilise `HistoryEventDto` (US-037) : le panneau réutilise le rendu de la timeline sans nouveau type.
- `count` = événements éligibles non vus (exact, non plafonné ; le « 99+ » est un affichage).
- `revision` = `"<maxEligibleId>:<count>:<provisionalEligibleCount>"` : change quand un événement apparaît, est
  fermé, purgé, ou **quand un provisoire est confirmé** (le nombre de provisoires baisse) — c'est ce qui permet au
  frontend de détecter la résolution asynchrone d'un provisoire (RG-040-05 c) sans WebSocket.
- `dismiss` est idempotent (déjà fermé → 204). `dismiss-all` ferme **toutes** les entrées éligibles, pas seulement
  les 50 listées, avec les préférences au moment de l'appel (RG-040-02).
- Aucune donnée sensible exposée (pas de jeton) : hors D5.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Migration `AddNotifications` | Migration | colonnes, index, backfill `dismissed_at`, réglages |
| Étendre `merge-request-event.entity.ts` | Entité | `dismissedAt` (+ `mrInvolvedUsernames` si retenu) |
| Étendre `settings.entity.ts` + DTOs + transfert | Entité / DTO | 3 réglages |
| `notifications/domain/notification-filter.ts` | Fonction pure | éligibilité + `buildRevision` |
| `notifications.service.ts` | Service | `list`, `summary`, `dismiss`, `dismissAll` (QueryBuilder) |
| `notifications.controller.ts` + DTOs | Controller | 4 routes ci-dessus |
| Renseigner `mr_involved_usernames` | Service | dans `history.service` / enrichment |
| Tests unitaires | Jest | domain, service (préférences, provisoire confirmé, purge), settings, transfert |
| `test/notifications.e2e-spec.ts` | e2e | cycle liste → dismiss → count ; dismiss-all > 50 ; préférences ; parité SQL |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `merge_request_events` | + colonne(s) nullable(s), + index | Faible | migration additive, backfill borné |
| `settings` | + 3 colonnes avec défaut | Faible | défaut = comportement « tout activé » |
| `HistoryEnrichmentService` inserts | peuple `mr_involved_usernames` | Moyen | valeur nullable ; tests d'enrichissement existants à compléter |
| `SettingsTransferService` | + clés optionnelles | Faible | import ancien fichier → défauts (test dédié) |
| Requêtes `history-query` | inchangées | Nul | la timeline montre tout, fermé ou non (RG-041-03) |

---

## Frontend

### Intégration dans les features existantes

- **`features/board/board-toolbar`** : cloche + compteur (`input` `notificationCount`, `output` `notificationsToggle`),
  entre « Rafraîchir » et « Historique » (design §1).
- **`features/board/notifications-panel/`** (nouveau) : tiroir `MatSidenav` (`position="end"`, `mode="over"`) monté
  dans `BoardPageComponent`.
- **`features/settings`** : passage en onglets (`MatTabNav`), onglet actif lu / écrit dans `?tab=`. Les composants
  de sections existants (`sections/*`) sont **réutilisés tels quels** et regroupés par onglet ; nouvelle section
  `sections/notifications/`. Le formulaire (`settings-form.ts`) reste unique (RG-042-02).
- Pas de nouvelle route : l'onglet est un query param de `/settings` (RG-042-03).

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatSidenav` | Material | tiroir du panneau |
| `MatTabNav` / `MatTabLink` | Material | onglets Paramètres (routés, `?tab=`) |
| `MatSlideToggle`, `MatCheckbox` | Material | périmètre, types d'événements |
| `MatBadge` (ou badge `shared/`) | Material | compteur de la cloche |
| `MatSnackBar` | Material | échec de fermeture |
| `HistoryEventRowComponent` | `features/history` | ligne du panneau (déplacer dans `shared/` ou l'exporter) |
| `describeEvent`, `toneOf` | `features/history` | libellés, ton (réutilisés) |
| `AvatarComponent`, `settings-section` | `shared/` | inchangés |

> `HistoryEventRowComponent` devient partagé par deux features : le déplacer vers
> `shared/history-event-row/` (déplacement sans changement de comportement, `git mv` + imports).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| `core/api/notifications.service.ts` | Service Angular | `get`, `getSummary`, `post dismiss`, `post dismissAll` |
| `stores/notifications.store.ts` | SignalStore | `events`, `count`, `revision`, `loading`, `error` ; méthodes `load`, `refreshIfChanged`, `dismiss` (optimiste + rollback), `dismissAll` |
| `models/notification.model.ts` | Interfaces | `NotificationList`, `NotificationSummary` |
| `notifications-panel.component.*` | Composant | tiroir, états vide / chargement / erreur (design §2) |
| Étendre `board-toolbar` | Composant | cloche + compteur, `aria-label` « Notifications, N non vues » |
| Étendre `settings.store` / `settings.model.ts` / `settings-form.ts` | État | 3 réglages |
| `settings-page` en onglets | Composant | 4 onglets, `?tab=`, point d'erreur / modification |
| `sections/notifications/` | Composant | périmètre + 18 types en 3 groupes + « Autres alertes » |
| i18n `fr.json` + `en.json` | i18n | `notifications.*`, `settings.tabs.*`, `settings.notifications.*` (liste du design §6) |
| Tests unitaires | Vitest | store (optimiste, rollback), panneau, toolbar, onglets, section |

### Rafraîchissement (RG-040-05)

`NotificationsStore.refreshIfChanged()` appelle `GET /notifications/summary` et ne recharge la liste que si
`revision` a changé (ou si le panneau est ouvert). Déclencheurs : (a) démarrage de `BoardPageComponent` ;
(b) transition `SyncStore.running` `true → false` ; (c) même cadence que le polling de `SyncStore`
(5 s pendant une synchro, 60 s sinon, `POLL_RUNNING_MS` / `POLL_IDLE_MS`) — c'est ce polling qui capte la
résolution d'un provisoire par le worker de file, via le changement de `revision`. Aucune nouvelle infrastructure
temps réel.

### Modifications sur l'existant

| Élément | Nature | Risque | Solution |
|---------|--------|--------|----------|
| `settings-page.component` | Structure en onglets | **Élevé** (`settings-page.component.spec.ts` 16 Ko, garde `unsaved-changes`) | rendre tous les onglets dans le même formulaire (`display` masqué, non démonté) pour ne perdre aucune saisie |
| `settings-form.ts` | + 3 champs, `dirty` / `valid` | Moyen | tests de transfert + `Réinitialiser` |
| « Divers » (ex-06) | Scindé (alertes → onglet Notifications) | Moyen | mêmes clés de réglages, seul le placement change |
| `board-toolbar` | + bouton | Faible | `input` avec défaut 0 |
| `HistoryEventRowComponent` | déplacé dans `shared/` | Faible | refactor mécanique, specs déplacés |
| Textes de section « Divers » | libellés `settings.misc.*` | Faible | clés conservées ; ajouter les nouveaux onglets |

---

## Points de vigilance globaux

- **Parité filtre domain / SQL** : une seule règle d'éligibilité, deux implémentations (domain pour les tests et la
  lecture documentaire, SQL pour la pagination et le compte). Test de parité obligatoire.
- **Exactitude du compteur** : `count` ignore la limite de 50 ; « 99+ » est purement visuel.
- **Résolution d'un provisoire** : un provisoire confirmé garde son id (`UPDATE`), donc son `dismissed_at` ; vérifier
  par test que `reconcileEvents` n'écrit jamais `dismissed_at`.
- **`dismiss-all` concurrent** d'une synchro : exécuter dans une transaction avec la même requête d'éligibilité ;
  un événement créé pendant l'appel reste « à traiter ».
- **Identité non résolue** : « Seulement mes MRs » ne retient rien (même règle que « Mes MRs ») ; avertissement UI.
- **Performance** : index `(dismissed_at, occurred_at)` ; `count` + `summary` appelés toutes les 60 s → requêtes
  indexées, volume ≤ 5 000 événements par défaut (RG-036).
- **Migration** : le `UPDATE … dismissed_at` est irréversible pour la distinction « avant / après » ; acceptable
  (RG-039-02).
- Pas d'impact sur le jeton GitLab ni sur le CORS (D5 non déclenché).

---

## Décisions
### Arbitrées par l'humain

- **[D3] Périmètre « Seulement mes MRs »** → **A** : colonne `mr_involved_usernames` (JSON, nullable) sur
  `merge_request_events`, remplie à l'insertion (auteur + reviewers + affectés au moment de l'événement).

### ✅ Prises en autonomie

| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Marqueur de notification | colonne `dismissed_at` sur `merge_request_events` | un seul journal ; provisoire → confirmé conserve l'état (UPDATE en place) ; purge gratuite | oui |
| Préférences | liste des types **désactivés** + 2 booléens dans `settings` | un type futur est activé d'office ; export / import triviaux | oui |
| Détection de la résolution d'un provisoire | `revision` renvoyée par `/summary`, polling aligné sur `SyncStore` | pas de WebSocket ni SSE (hors périmètre) ; latence ≤ 60 s | oui |
| Module | `modules/notifications/` dédié | feature-first ; `history/` reste sans dépendance retour | oui |
| API | 4 routes, `HistoryEventDto` réutilisé | pas de nouveau type de ligne côté frontend | oui |
| `dismiss-all` | toutes les entrées éligibles, en transaction | RG-040-02 | oui |
| Onglets | `MatTabNav` + `?tab=`, formulaire unique, onglets non démontés | RG-042-02 ; pas de perte de saisie | oui |
| `HistoryEventRowComponent` | déplacé dans `shared/` | réutilisé par 2 features | oui |
| Migration | backfill `dismissed_at` à l'instant du déploiement | RG-039-02 | non (valeur d'origine perdue, sans enjeu) |

---

## Ordre de réalisation suggéré
1. Migration TypeORM + entités (`dismissed_at`, réglages, `mr_involved_usernames` si A)
2. `notifications/domain/notification-filter.ts` + tests unitaires
3. Réglages : settings (entité, DTO, service, transfert) + tests
4. `notifications.service.ts` + controller + e2e (cycle, dismiss-all > 50, préférences, parité SQL)
5. Remplissage de `mr_involved_usernames` dans history / enrichment (si A) + tests
6. Frontend : modèles, service, `notifications.store`, réglages dans `settings.store` / `settings-form`
7. `HistoryEventRowComponent` → `shared/`, cloche de la toolbar, panneau
8. Section « Notifications » puis refonte en onglets de la page Paramètres
9. i18n fr / en, tests Vitest, validation manuelle contre `mockup.html`
