# US-004 — Synchronisation des MRs depuis GitLab

## 1. Reformulation

MR Board récupère, pour chaque repo configuré, les MRs ouvertes et leurs informations (auteur, reviewers, assignees,
approbation, commentaires, statistiques de diff, draft, dates, labels) et les stocke localement. L'utilisateur peut
forcer une synchronisation avec le bouton « Rafraîchir » et voit en permanence l'état de la dernière synchronisation
dans la toolbar. Sans jeton configuré, un bandeau l'invite à configurer l'application ; sans repo configuré, un état
vide invite à en ajouter.

**Frontière avec US-005** : cette US construit la machinerie de synchronisation (backend) et l'habillage de la
toolbar du tableau (frontend : statut, bouton Rafraîchir, bandeau, état vide). Elle **n'expose aucune API de lecture
des MRs** et **ne construit pas le tableau lui-même** : la zone du tableau garde son placeholder actuel
(« Le tableau des MRs arrive avec US-005 »). US-005 définira le contrat `GET /merge-requests` et les colonnes, en
s'appuyant sur les données que cette US aura commencé à persister.

## 2. User Stories

- **US-004** : En tant qu'utilisateur, je veux que l'application synchronise les MRs de mes repos avec GitLab et que je
  puisse forcer cette synchronisation, afin de disposer d'un cache à jour pour le futur tableau (US-005).
    - Priorité : Must
    - Complexité estimée : L
    - Dépendances : US-001, US-003

## 3. Règles de gestion

### Récupération et modèle de données

- **RG-004-01** : Pour chaque repo, les MRs ouvertes sont récupérées via l'API **GraphQL** de GitLab (pas REST) — une
  requête paginée par curseur par projet, réduisant fortement le nombre d'appels par rapport à REST (RG-G04 ancienne
  hypothèse confirmée, QO-004-02 close). Champs récupérés par MR : `iid`, `title`, `webUrl`, `draft`, `createdAt`,
  `updatedAt`, `userNotesCount` (RG-G08), `approved` (RG-G07), `labels`, `diffStatsSummary` (`fileCount`,
  `additions`, `deletions`), `author` (username, nom, avatar, url), `reviewers` (liste), `assignees` (liste). Le
  jeton est transmis via le même header `PRIVATE-TOKEN` que les appels REST existants (GitLab accepte ce header pour
  GraphQL aussi).
- **RG-004-02** : Persistance par upsert sur (`project_id`, `iid`). Chaque utilisateur GitLab rencontré (auteur,
  reviewer, assignee) est upserté dans `users` par `gitlab_user_id`. Un même repo peut avoir plusieurs reviewers et
  plusieurs assignees sur une même MR (RG-G06) : ils sont stockés en tables d'association
  (`merge_request_reviewers`, `merge_request_assignees`), pas en colonnes uniques — remplacées intégralement à
  chaque synchronisation de la MR (le jeu de reviewers/assignees d'une synchronisation à l'autre reflète l'état
  courant sur GitLab, pas un historique).
- **RG-004-03** : Les MRs présentes en base pour un projet mais absentes de la réponse GitLab pour ce projet sont
  supprimées (fermées/fusionnées, RG-G01). Une erreur sur un projet (RG-004-08) annule cette suppression pour ce
  projet (on ne supprime jamais sur la base d'une réponse qu'on n'a pas reçue).

### Date Ready (RG-G05)

- **RG-004-04** : Le calcul de `ready_at` suit exactement cette table de transition (essentielle : une valeur qui
  changerait à chaque synchronisation invaliderait tout le calcul du délai « Depuis Ready », US-007) :

  | Situation | `ready_at` résultant |
  |---|---|
  | MR jamais vue, non draft | `created_at` (GitLab) |
  | MR jamais vue, draft | `null` |
  | MR déjà en base, était draft, reçue non draft | horodatage de **cette** synchronisation (« maintenant ») |
  | MR déjà en base, était non draft, reçue non draft | **inchangé** (ne jamais réécrire une valeur déjà posée) |
  | MR déjà en base, était non draft, reçue draft | `null` |
  | MR déjà en base, était draft, reçue draft | **inchangé** (reste `null`) |

### Déclenchement et exclusivité

- **RG-004-05** : Une seule synchronisation à la fois pour toute l'application (RG-G16), via un verrou en mémoire
  (une seule instance du processus). `POST /sync` pendant une synchronisation en cours répond 202 `{ running: true }`
  sans en démarrer une nouvelle. `POST /sync` accepte un paramètre optionnel `projectId` pour ne synchroniser qu'un
  seul repo (utilisé après l'ajout d'un repo, RG-004-14) ; sans paramètre, tous les repos actifs sont synchronisés,
  **séquentiellement** (pas en parallèle, pour limiter la charge sur l'instance GitLab et simplifier le
  rate-limiting, RG-004-11).
- **RG-004-06** : Chaque synchronisation est tracée dans `sync_runs` : début, fin, statut final (`success` — tous les
  projets ciblés ont réussi ; `partial` — au moins un a échoué et au moins un a réussi ; `error` — tous ont échoué),
  message d'erreur agrégé (liste des repos en échec avec leur cause), nombre total de MRs synchronisées, déclencheur
  (`manual` — bouton Rafraîchir, enregistrement des paramètres, ou ajout d'un repo ; `scheduled` — réservé à US-013,
  jamais utilisé dans cette US).
- **RG-004-07** : Une erreur sur un projet (délai dépassé, GitLab indisponible, jeton refusé) n'interrompt pas la
  synchronisation des projets suivants dans la même exécution.

### Statut et affichage (toolbar)

- **RG-004-08** : Statut affiché dans la toolbar, dérivé de `GET /sync/status` (`{ running, lastRun, nextRunAt: null
  }`, `nextRunAt` toujours `null` tant que US-013 n'existe pas) :
  - pendant l'exécution : « Synchronisation en cours… » (texte accent, icône), barre de progression indéterminée
    2 px sous la toolbar, bouton « Rafraîchir » désactivé ;
  - sinon, selon `lastRun.status` : `success`/`partial` → « Synchronisé à l'instant » (< 1 min) ou « Synchronisé il y
    a N min » ; `error` → « Dernière synchro en échec il y a N min » (texte accent) ; absence de `lastRun` (jamais
    synchronisé) → « Jamais synchronisé » ;
  - le libellé relatif (« il y a N min ») est recalculé côté frontend toutes les 30 s sans nouvel appel réseau ;
    `GET /sync/status` est lui-même interrogé toutes les 5 s pendant une synchronisation, toutes les 60 s sinon, et
    seulement pendant que l'écran Tableau est affiché (le polling s'arrête en quittant la page).
- **RG-004-09** : Le bouton « Rafraîchir » déclenche `POST /sync` (sans `projectId`) et se désactive dès la requête
  envoyée, jusqu'à ce que `GET /sync/status` rapporte `running: false`.
- **RG-004-10** : Sans jeton configuré, un bandeau « Aucun jeton GitLab configuré. Les données affichées sont celles
  du dernier cache. » avec un bouton « Configurer » (→ `/settings`) est affiché au-dessus de la zone du tableau ; le
  bouton « Rafraîchir » est désactivé. Ce bandeau prend le pas sur l'état vide RG-004-11 (mutuellement exclusifs :
  celui-ci nécessite un jeton, RG-003-02).
- **RG-004-11** : Avec un jeton configuré mais aucun repo, un état vide « Aucun repo configuré » avec un bouton
  « Ajouter un repo » (→ `/settings`) est affiché à la place de la zone du tableau.
- **RG-004-12** : Si le jeton est refusé (401) pendant une synchronisation, le ou les projets concernés échouent
  avec le message « Jeton GitLab refusé » ; un toast d'erreur s'affiche une fois la synchronisation terminée si le
  run est `error` ou `partial`. Les données déjà en cache ne sont pas supprimées (RG-004-03).

### Résilience

- **RG-004-13** : En cas de réponse 429 (limite de débit) pendant la synchronisation d'un projet, le backend attend
  la durée indiquée par l'en-tête `Retry-After` (plafonnée à 30 s) puis réessaie une seule fois cette requête ; un
  nouveau 429 fait échouer le projet pour cette synchronisation (sans bloquer les autres projets, RG-004-07).
- **RG-004-14** : Le temps total de synchronisation d'un projet (toutes les pages GraphQL confondues) ne doit pas
  dépasser 60 s ; au-delà, le projet est marqué en échec pour cette synchronisation (timeout), sans interrompre les
  autres.
- **RG-004-15** : Une synchronisation est déclenchée automatiquement, côté frontend, immédiatement après un
  enregistrement réussi des paramètres (US-001, `PUT /settings`) et après l'ajout réussi d'un repo (US-003,
  `POST /projects`, ciblée sur ce seul repo via `projectId`). Ce déclenchement est asynchrone (« fire and forget ») :
  il ne bloque ni le toast ni la navigation déjà déclenchés par ces actions.

## 4. Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|---------------|---------|-------|
| POST | `/api/v1/sync` | `?projectId=<id>` optionnel | `{ running: true }` | 202 |
| GET | `/api/v1/sync/status` | — | `{ running: boolean, lastRun: SyncRunDto \| null, nextRunAt: null }` | 200 |

`SyncRunDto` : `{ startedAt: string, finishedAt: string, status: 'success' \| 'partial' \| 'error', mrCount: number,
errorMessage: string \| null, trigger: 'manual' \| 'scheduled' }`.

`POST /sync` avec un `projectId` inconnu répond 404. Aucune autre erreur métier : `POST /sync` accepte toujours de
démarrer (ou de rapporter qu'une synchronisation est déjà en cours) — les échecs GitLab sont capturés dans le
`sync_run`, pas renvoyés comme erreur HTTP de cet appel (RG-004-07).

## 5. Maquettes de référence

- Wireframe **1a** — toolbar « Synchronisé il y a 2 min », bouton « Rafraîchir »
- Wireframe **1b** — toolbar « Synchronisation en cours… », bouton « Rafraîchir » désactivé
- Prototype — `syncLabel`, `md-linear-progress`, bandeau `noToken`
- `docs/tech/architecture-frontend.md` — `features/board/board-toolbar/` (déjà prévu dans l'architecture initiale)

## 6. Critères d'acceptation

```gherkin
Scenario: Synchronisation manuelle réussie sur plusieurs repos
  Given 2 repos configurés et un jeton valide, GitLab renvoie 5 MRs ouvertes pour « api » et 2 pour « web »
  When je clique sur « Rafraîchir »
  Then POST /api/v1/sync répond 202 { running: true }
  And la toolbar affiche « Synchronisation en cours… » et la barre de progression
  And le bouton « Rafraîchir » est désactivé
  When la synchronisation se termine
  Then GET /api/v1/sync/status renvoie running: false et lastRun.status "success", lastRun.mrCount 7
  And la toolbar affiche « Synchronisé à l'instant »

Scenario: Upsert et suppression des MRs disparues
  Given la MR « api!412 » existe en base avec 3 commentaires et la MR « api!300 » existe en base
  When GitLab renvoie « api!412 » avec 5 commentaires et ne renvoie plus « api!300 » pour ce projet
  And une synchronisation de ce projet s'exécute avec succès
  Then « api!412 » a 5 commentaires en base
  And « api!300 » n'existe plus en base

Scenario: Reviewers et assignees multiples
  Given GitLab renvoie une MR avec 2 reviewers et 1 assignee
  When elle est synchronisée
  Then les 2 reviewers et l'assignee sont associés à cette MR en base
  And les 3 utilisateurs existent dans la table users

Scenario: Calcul de la date Ready à l'insertion (jamais draft)
  Given GitLab renvoie une MR non draft créée le 2026-09-01T10:00:00Z, jamais vue
  When elle est insérée
  Then ready_at = 2026-09-01T10:00:00Z

Scenario: Calcul de la date Ready à l'insertion (draft)
  Given GitLab renvoie une MR draft, jamais vue
  When elle est insérée
  Then ready_at = null

Scenario: Passage de draft à ready
  Given la MR « web!79 » est en base en draft (ready_at null)
  When GitLab la renvoie non draft lors d'une synchronisation exécutée à 2026-09-11T08:00:00Z
  Then ready_at = 2026-09-11T08:00:00Z (heure de la synchronisation, pas celle de GitLab)

Scenario: Ready stable d'une synchronisation à l'autre
  Given la MR « api!412 » est en base, non draft, ready_at = 2026-09-05T09:00:00Z
  When une nouvelle synchronisation la reçoit toujours non draft
  Then ready_at reste 2026-09-05T09:00:00Z (inchangé)

Scenario: Retour en draft
  Given la MR « web!79 » est en base avec ready_at renseigné
  When GitLab la renvoie en draft
  Then ready_at = null

Scenario: Erreur sur un seul projet parmi plusieurs
  Given GitLab répond en erreur pour « infra » et avec succès pour « api »
  When une synchronisation de tous les projets s'exécute
  Then les MRs de « api » sont mises à jour
  And les MRs déjà en base pour « infra » ne sont ni modifiées ni supprimées
  And le run a le statut "partial" avec un message mentionnant « infra »

Scenario: Jeton refusé sur tous les projets
  Given GitLab répond 401 pour tous les projets
  When une synchronisation s'exécute
  Then le run a le statut "error" avec un message mentionnant le jeton refusé
  And la toolbar affiche « Dernière synchro en échec il y a 0 min »
  And un toast d'erreur s'affiche
  And les MRs précédemment en cache restent affichées en base

Scenario: Synchronisation déjà en cours
  Given une synchronisation est en cours
  When j'appelle POST /api/v1/sync
  Then la réponse est 202 { running: true } et aucune seconde synchronisation n'est démarrée

Scenario: Synchroniser un seul projet après son ajout
  Given un jeton valide est configuré
  When j'ajoute un repo via /api/v1/projects
  Then une synchronisation ciblée sur ce seul projet est déclenchée automatiquement côté frontend

Scenario: Synchroniser après enregistrement des paramètres
  When j'enregistre les paramètres avec succès (PUT /api/v1/settings)
  Then une synchronisation de tous les projets est déclenchée automatiquement côté frontend

Scenario: Bandeau sans jeton
  Given aucun jeton n'est configuré
  When j'ouvre le tableau
  Then le bandeau « Aucun jeton GitLab configuré. » est affiché avec un bouton « Configurer »
  And le bouton « Rafraîchir » est désactivé
  When je clique sur « Configurer »
  Then je suis redirigé vers /settings

Scenario: Aucun repo configuré
  Given un jeton est configuré mais aucun repo
  When j'ouvre le tableau
  Then un état vide « Aucun repo configuré » avec un bouton « Ajouter un repo » est affiché
  And le bandeau « Aucun jeton » n'est pas affiché

Scenario: Pagination GraphQL
  Given GitLab renvoie 150 MRs ouvertes pour « api » sur plusieurs pages (curseur)
  When une synchronisation de ce projet s'exécute
  Then les 150 MRs sont en base

Scenario: Rate limiting avec nouvelle tentative réussie
  Given GitLab répond 429 avec Retry-After: 2 puis 200 au second essai
  When une synchronisation de ce projet s'exécute
  Then le projet est synchronisé avec succès après une seule nouvelle tentative

Scenario: Rate limiting persistant
  Given GitLab répond 429 deux fois de suite pour un projet
  When une synchronisation s'exécute
  Then ce projet échoue pour cette synchronisation, les autres projets ne sont pas affectés

Scenario: Dépassement du délai par projet
  Given la synchronisation d'un projet dépasse 60 s
  When elle est interrompue par le timeout
  Then ce projet est marqué en échec pour cette synchronisation
  And les autres projets continuent d'être synchronisés

Scenario: Statut relatif mis à jour sans nouvel appel réseau
  Given la dernière synchronisation date de 2 minutes
  Then la toolbar affiche « Synchronisé il y a 2 min »
  When 1 minute s'écoule sans nouvelle synchronisation ni requête
  Then la toolbar affiche « Synchronisé il y a 3 min » (recalcul local)

Scenario: Jamais synchronisé
  Given aucune synchronisation n'a jamais eu lieu
  When j'ouvre le tableau
  Then la toolbar affiche « Jamais synchronisé »
```

## 7. Questions ouvertes

- QO-004-01 : Faut-il synchroniser aussi les MRs fermées/fusionnées récemment pour un historique ? Hypothèse : non
  (RG-G01) — hors périmètre de MR Board v1.
- QO-004-02 *(close)* : GraphQL retenu pour la récupération (RG-004-01), une seule requête paginée par projet.
- QO-004-03 : Faut-il un bouton « Annuler la synchronisation » en cours ? Hypothèse : non — une synchronisation reste
  bornée par les timeouts (RG-004-14), l'attente maximale raisonnable.
- QO-004-04 : Faut-il paginer les listes `reviewers`/`assignees` elles-mêmes si une MR en a un très grand nombre (au
  delà de la première page GraphQL, ~100) ? Hypothèse : non, cas non réaliste pour l'usage visé (équipe restreinte).
- QO-004-05 : Le message d'erreur agrégé d'un run `partial`/`error` doit-il lister le détail par projet dans
  `sync_runs`, ou seulement un résumé texte ? Hypothèse : un résumé texte suffisant pour le toast (RG-004-06) ; le
  détail par projet n'est pas exposé dans l'UI de cette US (pas d'historique des synchronisations, hors périmètre).

## 8. Hors périmètre

- Synchronisation planifiée automatique (US-013) — le champ `trigger: 'scheduled'` et `nextRunAt` existent déjà dans
  le contrat pour ne pas le casser plus tard, mais ne sont jamais utilisés dans cette US
- Webhooks GitLab (push) — la v1 est en pull uniquement
- Historique des synchronisations dans l'UI (au-delà du statut de la dernière)
- Le tableau des MRs lui-même et son contrat `GET /merge-requests` (US-005)
- Pagination/traitement au-delà de la première page pour les listes reviewers/assignees d'une même MR (QO-004-04)
- Flag `enabled` par repo (QO-003-01, colonne déjà en base depuis US-003, toujours `true`, non piloté par l'UI)
