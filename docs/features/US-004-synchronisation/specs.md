# US-004 — Synchronisation des MRs depuis GitLab

## 1. Reformulation

MR Board récupère, pour chaque repo configuré, les MRs ouvertes et leurs informations (auteur, reviewers, assignees,
approbations, commentaires, statistiques de diff, draft, dates) et les stocke localement. L'utilisateur peut forcer une
synchronisation avec le bouton « Rafraîchir » et voit en permanence l'état de la dernière synchronisation dans la
toolbar. Sans jeton configuré, un bandeau l'invite à configurer l'application.

## 2. User Stories

- **US-004** : En tant qu'utilisateur, je veux que l'application synchronise les MRs de mes repos avec GitLab et que je
  puisse forcer cette synchronisation, afin de disposer d'un tableau à jour.
    - Priorité : Must
    - Complexité estimée : L
    - Dépendances : US-001, US-003

## 3. Règles de gestion

- **RG-004-01** : Une synchronisation parcourt tous les repos activés. Pour chaque repo : `GET /projects/:id/merge_requests?state=opened&per_page=100` (paginé), puis pour chaque MR : approbations (`/approvals` → `approved_by`), et statistiques de diff (`fileCount`, `additions`, `deletions` — voir QO-G04). `user_notes_count`, `draft`, `author`, `reviewers`, `assignees`, `labels`, `created_at`, `updated_at`, `web_url`, `iid` proviennent de la liste.
- **RG-004-02** : Persistance par upsert sur (`project_id`, `iid`). Les MRs présentes en base mais absentes de la réponse GitLab sont supprimées (RG-G01). Les utilisateurs rencontrés sont upsertés dans `users`.
- **RG-004-03** : Date Ready calculée selon RG-G05 : à l'insertion, `ready_at = created_at` si non draft, sinon `null` ; à la mise à jour, si la MR passe de draft à non-draft, `ready_at = now` ; si elle repasse en draft, `ready_at = null`.
- **RG-004-04** : Une seule synchronisation à la fois (RG-G16). `POST /sync` pendant une synchronisation en cours répond 202 avec `{ running: true }` sans en lancer une nouvelle. `POST /sync?projectId=X` synchronise un seul projet (utilisé par US-003).
- **RG-004-05** : Chaque synchronisation est tracée dans `sync_runs` (début, fin, statut `success` / `partial` / `error`, message, nombre de MRs, déclencheur `manual` / `scheduled`). Une erreur sur un projet donne `partial` et n'interrompt pas les autres.
- **RG-004-06** : Statut affiché dans la toolbar : « Synchronisation en cours… » (accent, icône) pendant l'exécution ; « Synchronisé à l'instant » (< 1 min) ; « Synchronisé il y a N min » ; « Dernière synchro en échec il y a N min » (rouge) si le dernier run est `error`. Le libellé est recalculé toutes les 30 s côté frontend. Le statut est obtenu par `GET /sync/status` et rafraîchi par polling (toutes les 5 s pendant une synchronisation, toutes les 60 s sinon).
- **RG-004-07** : Le bouton « Rafraîchir » lance `POST /sync`, est désactivé pendant la synchronisation ; une barre de progression indéterminée de 2 px s'affiche sous la toolbar. À la fin, la liste des MRs est rechargée automatiquement.
- **RG-004-08** : Sans jeton configuré, un bandeau « Aucun jeton GitLab configuré. Les données affichées sont celles du dernier cache. » avec bouton « Configurer » (→ `/settings`) est affiché au-dessus des filtres ; « Rafraîchir » est désactivé ; le tableau affiche les MRs en cache s'il y en a.
- **RG-004-09** : Sans aucun repo configuré (mais jeton présent), le tableau affiche un état vide « Aucun repo configuré » avec un bouton « Ajouter un repo » (→ `/settings`).
- **RG-004-10** : Si le jeton est refusé (401) pendant une synchronisation, le run est `error` avec message « Jeton GitLab refusé », un toast est affiché et le statut toolbar passe en rouge. Les données en cache restent affichées.
- **RG-004-11** : Rate limiting : en cas de 429, le backend attend `Retry-After` (max 30 s) puis réessaie une fois ; sinon le projet est marqué en erreur.
- **RG-004-12** : Le temps de synchronisation d'un repo ne doit pas dépasser 60 s (timeout global par projet) ; au-delà, le projet est en erreur (`partial`).
- **RG-004-13** : Après l'enregistrement des paramètres (RG-001-06) et après l'ajout d'un repo (RG-003-10), une synchronisation est déclenchée automatiquement.

## 4. Maquettes de référence

- Wireframe **1a** — toolbar « Synchronisé il y a 2 min », bouton « Rafraîchir »
- Wireframe **1b** — toolbar « Synchronisation en cours… », bouton « Rafraîchir » désactivé
- Prototype — `syncLabel`, `md-linear-progress`, bandeau `noToken`

## 5. Critères d'acceptation

```gherkin
Scenario: Synchronisation manuelle réussie
  Given 2 repos configurés et un jeton valide, GitLab renvoie 5 MRs ouvertes pour « api » et 2 pour « web »
  When je clique sur « Rafraîchir »
  Then POST /api/v1/sync répond 202 { running: true }
  And la toolbar affiche « Synchronisation en cours… » et la barre de progression
  And le bouton « Rafraîchir » est désactivé
  When la synchronisation se termine
  Then GET /api/v1/sync/status renvoie { running: false, lastRun: { status: "success", mrCount: 7, finishedAt: … } }
  And la toolbar affiche « Synchronisé à l'instant »
  And le tableau affiche 7 MRs

Scenario: Upsert et suppression
  Given la MR « api!412 » existe en base avec 3 commentaires et la MR « api!300 » existe en base
  When GitLab renvoie « api!412 » avec 5 commentaires et ne renvoie plus « api!300 »
  And une synchronisation s'exécute
  Then « api!412 » a 5 commentaires en base
  And « api!300 » n'existe plus en base

Scenario: Calcul de la date Ready à l'insertion
  Given GitLab renvoie une MR non draft créée le 2026-09-01T10:00:00Z, jamais vue
  When elle est insérée
  Then ready_at = 2026-09-01T10:00:00Z

Scenario: Passage de draft à ready
  Given la MR « web!79 » est en base en draft (ready_at null)
  When GitLab la renvoie non draft lors d'une synchronisation à 2026-09-11T08:00:00Z
  Then ready_at = 2026-09-11T08:00:00Z

Scenario: Retour en draft
  Given la MR « web!79 » est en base avec ready_at renseigné
  When GitLab la renvoie en draft
  Then ready_at = null

Scenario: Erreur sur un seul projet
  Given GitLab répond 500 pour « infra » et 200 pour « api »
  When une synchronisation s'exécute
  Then les MRs de « api » sont mises à jour
  And le run a le statut « partial » avec le message mentionnant « infra »

Scenario: Jeton refusé
  Given GitLab répond 401
  When une synchronisation s'exécute
  Then le run a le statut « error » et le message « Jeton GitLab refusé »
  And la toolbar affiche « Dernière synchro en échec il y a 0 min » en rouge
  And un toast d'erreur s'affiche
  And les MRs précédemment en cache restent affichées

Scenario: Synchronisation déjà en cours
  Given une synchronisation est en cours
  When j'appelle POST /api/v1/sync
  Then la réponse est 202 { running: true } et aucune seconde synchronisation n'est lancée

Scenario: Bandeau sans jeton
  Given aucun jeton n'est configuré
  When j'ouvre le tableau
  Then le bandeau « Aucun jeton GitLab configuré. » est affiché avec un bouton « Configurer »
  And le bouton « Rafraîchir » est désactivé
  When je clique sur « Configurer »
  Then je suis sur /settings

Scenario: Aucun repo configuré
  Given un jeton est configuré mais aucun repo
  When j'ouvre le tableau
  Then un état vide « Aucun repo configuré » avec un bouton « Ajouter un repo » est affiché

Scenario: Pagination GitLab
  Given GitLab renvoie 150 MRs ouvertes pour « api » sur 2 pages
  When une synchronisation s'exécute
  Then les 150 MRs sont en base

Scenario: Statut relatif mis à jour
  Given la dernière synchronisation date de 2 minutes
  Then la toolbar affiche « Synchronisé il y a 2 min »
  When 1 minute s'écoule sans synchronisation
  Then la toolbar affiche « Synchronisé il y a 3 min »
```

## 6. Questions ouvertes

- QO-004-01 : Faut-il synchroniser aussi les MRs fermées/fusionnées récemment pour un historique ? Hypothèse : non (RG-G01).
- QO-004-02 : GraphQL vs REST pour les statistiques de diff (voir QO-G04). Hypothèse : GraphQL `project.mergeRequests(state: opened)` avec `diffStatsSummary`, `approvedBy`, `userNotesCount`, `reviewers`, `assignees` en une seule requête paginée par projet, ce qui réduit fortement le nombre d'appels.
- QO-004-03 : Faut-il un bouton « Annuler la synchronisation » ? Hypothèse : non.

## 7. Hors périmètre

- Synchronisation planifiée (US-013)
- Webhooks GitLab (push) — la v1 est en pull uniquement
- Historique des synchronisations dans l'UI
