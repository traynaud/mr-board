# Architecture — US-034 File asynchrone et enrichissement forge

## Résumé fonctionnel
> En arrière-plan, un worker traite la file « une entrée par MR » : il interroge la forge, récupère les événements
> réels (qui, quand, commentaires), met à jour les événements provisoires correspondants et crée les autres.

---

## Backend

### Impacts sur le modèle de données
- **`history_queue`** : + colonne `since` text **nullable** (début de la fenêtre à relire = le plus ancien des
  déclencheurs en attente). Migration `AddHistoryQueueSince1757602200000` (`ALTER … ADD COLUMN`, sans reconstruction).
  Absence de valeur → repli sur `requested_at`.
- Aucune autre table : `merge_request_events` (`status`, `source_event_id`, unicité `(connection_id, source_event_id)`) a
  été prévue en US-033.

### Contrat `ForgeClient` (nouvelle méthode, RG-034-04)
`fetchMergeRequestEvents(url, token, project, iid, { since, deadlineAt }) → ForgeMergeRequestEvent[]`
où `ForgeMergeRequestEvent = { sourceEventId, type, occurredAt, actor: {username,name,avatarUrl}|null, oldValue, newValue }`
(mêmes types et mêmes valeurs JSON que le journal). Retourne `[]` si la MR est introuvable (traité par US-035).
- **GitLab** (REST, `PRIVATE-TOKEN`) : `…/merge_requests/:iid/notes` (tri décroissant, arrêt sous `since`) et
  `…/resource_label_events`. Note utilisateur → `commented` (extrait 200 car.). Note **système** → analyse du texte
  anglais de GitLab : draft/ready, `approved`/`unapproved`, `requested review from @u`/`removed review request for @u`,
  `assigned to @u`/`unassigned @u`, `changed title` (valeurs non exploitables : balisage de diff → `old/new = null`).
  Libellés via `resource_label_events` (structurés). Texte non reconnu → ignoré (l'événement provisoire reste tel quel).
- **GitHub** (REST `…/issues/:n/timeline`) : `renamed`, `convert_to_draft`, `ready_for_review`,
  `review_requested`/`review_request_removed`, `assigned`/`unassigned`, `labeled`/`unlabeled`, `reviewed` (état
  `approved`), `commented`.
- Bornes : 10 pages × 100 max, délai `deadlineAt`, mêmes exceptions que les autres appels (401/403 →
  `ForgeAuthException`, réseau/5xx/429 → `ForgeUnavailableException`, dépassement → `ForgeTimeoutException`).
- Hors US-034 : `merged` / `closed` / `reopened` / `deleted` (US-035).

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| `history/domain/reconcile-events.ts` | Fonction pure | Appariement provisoire ↔ forge (RG-034-06) : mise à jour ou création, idempotence par `source_event_id` |
| `history/domain/compute-retry-delay.ts` | Fonction pure | Attente croissante (1, 2, 4, 8 min), 5 tentatives max (RG-034-07) |
| `history/history-enrichment.service.ts` | Service | Sélection FIFO des entrées échues, parallélisme 2, traitement transactionnel, suppression conditionnelle de l'entrée |
| `history/history-queue.scheduler.ts` | Scheduler | `@Interval(10 s)`, inactif en `NODE_ENV=test` (comme `SyncScheduler`) |
| `gitlab/mappers/map-gitlab-notes-to-events.ts`, `github/mappers/map-github-timeline-events.ts` | Fonctions pures | Mapping forge → `ForgeMergeRequestEvent` |
| `GitlabClientService` / `GithubClientService` | Client | Implémentation de la méthode |
| Migration + specs + e2e (forge mockée) | | |

### Modifications sur l'existant
| Élément | Modification | Risque | Solution |
|---|---|---|---|
| `HistoryService` | `since` à l'enfilement (min avec l'existant) ; `created` créé **confirmé** (acteur = auteur, date = `createdAt` de la MR, exacts sans appel forge) | Faible | Tests mis à jour |
| `MergeRequestSnapshot` / `getSnapshots` | + `syncedAt?` (début de la fenêtre) | Faible | Optionnel |
| `ForgeClient` + mocks de specs | Nouvelle méthode obligatoire | Faible | Mocks complétés |
| `HistoryModule` | imports Connections, Projects, Forges | Faible | Pas de cycle (aucun ne dépend de History) |

---

## Frontend
Aucun impact.

---

## Points de vigilance globaux
- **Analyse du texte des notes système GitLab** : dépend du libellé anglais de GitLab (non versionné). Mitigation :
  analyse tolérante, tests sur des exemples réels, tout texte non reconnu ignoré, jamais bloquant. **À valider sur une
  instance réelle** (un échec se traduit par des événements qui restent « provisoires », pas par une perte).
- **Appariement** : clé = `type` + sujet (label, username ; titre et draft sans sujet). Un provisoire est mis à jour
  sur `acteur`, `date`, `statut`, `source_event_id` seulement : ses valeurs (plus riches : nom complet) sont conservées.
- **Idempotence** : événements déjà connus ignorés via `source_event_id` ; insertion `OR IGNORE`.
- **Re-demande pendant le traitement** : l'entrée n'est supprimée que si `requested_at` n'a pas changé depuis la lecture.
- **Fenêtre** : `since` = `synced_at` précédent de la MR − 5 min (dérive d'horloge ; recouvrement neutralisé par
  l'idempotence) ; MR nouvelle : `created_at`.
- **Jetons** : relus depuis la connexion au traitement, jamais stockés dans la file ni logués (RG-034-08).
- **Charge** : 1 à 2 appels forge par MR en file, parallélisme 2, hors cycle de synchro.
- **Commentaires** : extrait de 200 caractères (hypothèse validée, réversible).

---

## Décisions
### 🛑 Arbitrage humain requis
Aucun.

### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Colonne `since` nullable | Oui | ALTER sans reconstruction, tolère les entrées US-033 | oui |
| `created` confirmé dès US-033 | Acteur = auteur, date = `createdAt` | Info exacte déjà dans la réponse forge | oui |
| Valeurs du provisoire conservées | Mise à jour acteur/date/statut/source seulement | Évite de dégrader `name` | oui |
| Notes système GitLab | REST + analyse du texte | Seule source de l'acteur pour titre/draft/relecteurs/approbations | oui |
| Cadence du worker | 10 s, lot de 2, 5 tentatives | Valeurs prudentes | oui |

---

## Ordre de réalisation suggéré
1. Migration + `since` + `created` confirmé
2. Types forge + mappers GitLab / GitHub + tests
3. Méthode des deux clients + tests
4. Domain `reconcile-events`, `compute-retry-delay` + tests
5. Service d'enrichissement + scheduler + module + tests
6. e2e
