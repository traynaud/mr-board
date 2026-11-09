# Architecture — US-033 Détection et journal des modifications

## Résumé fonctionnel
> À chaque synchronisation d'un projet, MR Board compare l'état reçu à l'état précédent, journalise chaque
> différence du catalogue en événement provisoire (acteur inconnu) et place la MR dans une file persistante
> (une entrée par MR) que US-034 consommera.

Périmètre US-033 : détection + événements provisoires + mise en file + baseline. **Hors US-033** : worker et
enrichissement forge (US-034), clôtures / `reopened` / `deleted` (US-035), rétention (US-036), API de lecture, page
et filtres (US-037/038). Le curseur d'événements forge de RG-033-05 relève d'US-034 (spec ajustée).

---

## Backend

### Impacts sur le modèle de données
- **Nouvelles entités** (module `history`, aucune FK vers `merge_requests` ni `users`) :
  - `merge_request_events` : `id` PK, `occurred_at` text, `detected_at` text, `type` text, `status` text
    (`provisional`|`confirmed`, défaut `provisional`), `source_event_id` text null, `connection_id` integer,
    `project_id` integer (FK `projects` ON DELETE CASCADE), `mr_iid` integer, `mr_title`, `mr_web_url`,
    `project_alias` (instantanés), `actor_username|actor_name|actor_avatar_url` text null, `old_value`,
    `new_value` text null (JSON).
    Index : `(occurred_at)`, `(project_id, occurred_at)`, `(type, occurred_at)`, `(project_id, mr_iid)` ;
    `UNIQUE (connection_id, source_event_id)` (NULL distincts en SQLite).
  - `history_queue` : `id` PK, `project_id` (FK CASCADE), `mr_iid`, `mr_title`, `mr_web_url`, `requested_at`,
    `attempts` integer défaut 0, `next_attempt_at` text null ; `UNIQUE (project_id, mr_iid)` → « une MR = une
    entrée », mise à jour par `upsert`.
  - `history_baselines` : `project_id` PK (FK CASCADE), `baselined_at` — marque « projet déjà synchronisé une fois »
    (RG-033-05) sans toucher `projects` (évite un ALTER et l'impact sur tous les mocks `Project`).
- **Migration** : `CreateHistory1757602100000` (3 `CREATE TABLE` + index ; `down` = `DROP`).
- Aucune modification d'entité existante.

### Intégration dans les modules existants
- Nouveau module `history` (`HistoryService`, domain pur, 3 entités), importé par `SyncModule`.
- `MergeRequestsService` : nouvelle méthode `getSnapshots(projectId)` (lecture de l'état précédent : MR, labels,
  relecteurs, affectés, approbateurs, commentaires). Aucune autre modification.
- `SyncService.syncProject` : `getSnapshots` **avant** l'upsert, `history.recordProjectChanges` **après**
  upsert/`deleteMissing`. Erreur d'historique : `warn` logué, la synchro du projet reste en succès (RG-034-07).

### Contrat API
Aucun endpoint dans cette US.

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| `history/domain/detect-merge-request-changes.ts` | Fonction pure | Diff `previous`/`incoming` → événements + besoin d'enrichissement |
| `history/domain/merge-request-snapshot.ts` | Types | `MergeRequestSnapshot`, `snapshotFromForge` |
| `history/entities/*.entity.ts` (3) | Entités | Voir ci-dessus |
| `history/history.service.ts` | Service | Baseline, détection par projet, transaction événements + file |
| `history/history.module.ts` | Module | |
| `merge-requests.service.ts#getSnapshots` | Service | État précédent |
| `sync.service.ts` | Orchestration | Branchement |
| `database/migrations/…CreateHistory.ts` | Migration | |
| Specs + `test/history.e2e-spec.ts` | Tests | Unitaires + e2e sur SQLite `:memory:` |

### Modifications sur l'existant
| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `SyncService` (constructeur) | + `HistoryService` | Faible | Mettre à jour `sync.service.spec.ts` |
| `MergeRequestsService` | + `getSnapshots` | Faible | Lecture seule |

---

## Frontend
Aucun impact.

---

## Points de vigilance globaux
- **Atomicité (RG-033-06)** : les upserts de `MergeRequestsService` utilisent des repositories injectés, hors
  transaction. Les événements et la file sont écrits dans **une transaction** (`DataSource.transaction`), *après*
  les upserts. Fenêtre résiduelle : échec d'écriture de l'historique après upsert réussi → différence perdue
  (loguée). Rendre les upserts transactionnels imposerait de refactorer tout `upsertOne` sur `EntityManager` :
  écarté (réversible, hors périmètre).
- **Baseline** : projets déjà synchronisés avant la migration n'ont pas de baseline → la 1re synchro après mise à
  jour est silencieuse (comportement voulu, pas de rafale de faux `created`).
- **Format des valeurs** (JSON texte) : titre `"Titre"`, draft `false`/`true`, label `"bug"`, utilisateur
  `{"username":"alice","name":"Alice"}` — clé d'identité = `remoteUserId` pour la comparaison.
- **Ordre déterministe** des événements d'une MR : titre, draft, labels (ajoutés puis retirés), relecteurs,
  affectés, approbations ; tri alphabétique à l'intérieur de chaque groupe.
- **`created`** émis seulement si le projet est déjà baseliné. `reopened` n'existe qu'avec US-035.
- **Sécurité** : aucun jeton ni contenu de commentaire dans cette US.
- **Charge** : une lecture groupée par projet (4 requêtes), comparaison en mémoire, 2 écritures groupées.

---

## Décisions
### 🛑 Arbitrage humain requis
Aucun.

### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Marqueur de baseline | Table `history_baselines` | Évite ALTER `projects` et l'impact sur les mocks | oui |
| File livrée dès US-033 | Table + mise en file, sans worker | RG-033-06 exige l'écriture dans la même transaction ; entrées bornées (≤ 1 par MR) | oui |
| Transaction | Événements + file seulement | Refacto de `upsertOne` disproportionné | oui |
| Valeurs en JSON texte | Oui | Cohérent avec `labels` | oui |
| Curseur forge | Déplacé en US-034 | Sans consommateur dans US-033 | oui |

---

## Ordre de réalisation suggéré
1. Migration + entités
2. Domain pur + tests
3. `HistoryService` + tests ; `MergeRequestsService.getSnapshots` + tests
4. Branchement `SyncService` + tests
5. e2e
