# Architecture — US-035 Clôtures, fusions et MRs introuvables

## Résumé fonctionnel
> Quand une MR disparaît du tableau, la forge est interrogée par `iid` : l'historique reçoit `merged`, `closed` ou
> `deleted`, avec l'acteur et la date exacts quand la forge les fournit. Une MR fermée puis réapparue ouverte donne
> `reopened` et non `created`.

---

## Backend

### Impacts sur le modèle de données
- **`history_queue`** : + `kind` text NOT NULL DEFAULT `'update'` (`'update' | 'disappeared'`). Migration
  `AddHistoryQueueKind1757602300000` (`ALTER … ADD COLUMN`). `disappeared` est **collant** : une re-demande `update`
  ne le rétrograde pas (sinon la clôture serait perdue si la MR réapparaît avant le traitement).
- Aucune autre table : `merge_request_events` porte déjà tout (types `merged`, `closed`, `deleted`, `disappeared`,
  `reopened` prévus au catalogue).

### Contrat `ForgeClient`
`fetchMergeRequestState(url, token, project, iid, { deadlineAt }) → ForgeMergeRequestState | null`
avec `{ state: 'opened'|'merged'|'closed', occurredAt: string|null, actor: ForgeEventActor|null }` ; `null` = MR
introuvable (404).
- **GitLab** : `GET /api/v4/projects/:id/merge_requests/:iid` → `state` (`locked` = encore ouverte), `merged_at` /
  `merge_user` (repli `merged_by`), `closed_at` / `closed_by`.
- **GitHub** : `GET /repos/:o/:r/pulls/:n` → `merged` / `merged_at` / `merged_by` ; MR fermée non fusionnée :
  `GET /repos/:o/:r/issues/:n` pour `closed_by` (le endpoint `pulls` ne l'expose pas).
- Une seule source par événement terminal (pas de doublon avec les événements US-034, qui n'incluent ni
  `merged` ni `closed` ni `reopened`) ; identifiant déterministe `state:<état>:<date>`.

### Traitement (worker, RG-035-02/03)
Entrée `kind = 'disappeared'` : enrichissement habituel (US-034) **puis** `fetchMergeRequestState` ; dans la même
transaction : création de l'événement terminal (`INSERT … OR IGNORE`) et suppression conditionnelle de l'entrée.
| État | Événement |
|---|---|
| `merged` | `merged`, `"opened"` → `"merged"`, acteur `merge_user`, date `merged_at` |
| `closed` | `closed`, idem, acteur `closed_by`, date `closed_at` |
| `null` (404) | `deleted`, acteur inconnu, date = demande de traitement (`requested_at`), id `deleted:<iid>:<requested_at>` |
| `opened` | aucun (anomalie de pagination : la MR reviendra) |
Dates manquantes → `requested_at`. Après 5 échecs : événement de repli `disappeared` (provisoire) puis abandon (RG-034-07).

### Détection (synchro, `HistoryService`)
- **Disparition (RG-035-01/04)** : MRs du snapshot précédent absentes de la réponse d'un projet synchronisé *avec
  succès* → entrée `disappeared` (instantané titre / URL du snapshot, `since` = synchro précédente − 5 min). Une
  synchro en échec n'atteint jamais ce code ; la suppression du projet cascade file et historique.
- **Réouverture (RG-035-05)** : MR « nouvelle » dont le **dernier** événement connu (`occurred_at`, `id` décroissants)
  est `merged`/`closed` → `reopened` (ancien : l'état précédent, nouveau : `"opened"`) au lieu de `created` ;
  fenêtre forge = date de cet événement. Limite assumée : si la clôture n'est pas encore traitée (file), l'événement
  reste `created`.

### Nouvelles tâches techniques
| Tâche | Type |
|-------|------|
| Migration `kind` + entité | Migration |
| `forges/types/forge-merge-request-state.ts`, `ForgeClient.fetchMergeRequestState` | Contrat |
| `gitlab/mappers/map-gitlab-merge-request-state.ts`, `github/mappers/map-github-pull-state.ts` + clients | Fonctions pures + clients |
| `history/domain/build-terminal-event.ts` | Fonction pure (état → événement) |
| `HistoryService` (disparitions, `reopened`, `kind` collant), `HistoryEnrichmentService` (état terminal, repli) | Services |
| Specs + e2e | Tests |

### Modifications sur l'existant
| Élément | Modification | Risque | Solution |
|---|---|---|---|
| `ForgeClient` + mocks | Nouvelle méthode | Faible | Mocks complétés |
| `HistoryService` | + lecture du dernier événement des MRs nouvelles | Faible | 1 requête groupée |
| `HistoryEnrichmentService.recordFailure` | Repli `disappeared` | Faible | Même transaction logique que l'abandon |

---

## Frontend
Aucun impact.

---

## Points de vigilance globaux
- **Champs GitLab** `merge_user` (récent) / `merged_by` (déprécié) : les deux lus ; absents → acteur inconnu.
- **GitHub** : fermeture sans fusion = 2 appels ; l'échec du second fait échouer l'entrée (retry), jamais la synchro.
- **Idempotence** : `state:<état>:<date>` + `OR IGNORE` ; rejouer ne duplique pas.
- **Sécurité** : jeton relu à chaque traitement, jamais logué. Pas de donnée nouvelle sensible.
- **Désactivation de projet** : non applicable aujourd'hui (pas de bascule `enabled` dans l'API) ; la suppression
  cascade tout (RG-035-04 satisfaite).

---

## Décisions
### 🛑 Arbitrage humain requis
Aucun.

### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Source de l'état terminal | Appel d'état dédié, pas la timeline | Une source = pas de doublon | oui |
| `kind` collant | `disappeared` jamais rétrogradé | Évite de perdre une clôture | oui |
| `reopened` | Déduit du dernier événement connu | Pas de signal forge dans US-034 | oui |
| Acteur d'un `deleted` | Inconnu, confirmé | La forge a répondu 404 | oui |

---

## Ordre de réalisation suggéré
1. Migration, types, mappers, clients
2. `build-terminal-event` + `HistoryService`
3. Worker (état terminal, repli)
4. Specs + e2e
