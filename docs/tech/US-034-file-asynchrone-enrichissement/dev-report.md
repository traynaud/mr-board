# Rapport de livraison — US-034 File asynchrone et enrichissement forge

## Backend
**Créés** : migration `AddHistoryQueueSince` ; `forges/types/forge-merge-request-event.ts` ;
`gitlab/mappers/map-gitlab-notes-to-events.ts`, `github/mappers/map-github-timeline-events.ts` ;
`history/domain/{reconcile-events,compute-retry-delay}.ts` ; `history/history-enrichment.service.ts`,
`history/history-queue.scheduler.ts` (+ specs pour chacun).
**Modifiés** : `ForgeClient` (+ `fetchMergeRequestEvents`), `GitlabClientService`, `GithubClientService`,
`HistoryService` (`since`, `created` confirmé), `HistoryModule`, `history_queue` (`since`), `MergeRequestSnapshot` /
`getSnapshots` (`syncedAt`), `test/history.e2e-spec.ts`.
**Tests** : 731 unitaires, e2e verts (history : 12), lint / `tsc` / build OK. Couverture globale 98,9 % lignes.

## Frontend
Aucun impact.

## Risques traités
- ✅ Une MR = une entrée de file, `since` conservé au plus ancien → testé (unitaire + e2e).
- ✅ Idempotence : `source_event_id` + `INSERT … OR IGNORE` ; un second passage ne crée aucun doublon (e2e).
- ✅ Re-demande pendant le traitement : l'entrée n'est supprimée que si `requested_at` est inchangé.
- ✅ Échec forge : attente 1/2/4/8 min, abandon à la 5e tentative ; la synchro n'est jamais impactée (worker hors cycle).
- ✅ Jeton relu depuis la connexion, jamais stocké ni logué (seul `error.name` est logué).
- ✅ Un seul run à la fois ; plafond de 50 entrées par run ; parallélisme 2.

## Écarts par rapport au plan
Aucun. Précision : le titre n'est pas exploitable côté GitLab (balisage de diff) → appariement sur le seul type, les
valeurs provisoires sont conservées.

## Points d'attention pour la review
- **Analyse du texte des notes système GitLab** (anglais) : à valider sur une instance réelle ; un texte non reconnu
  laisse l'événement provisoire (pas de perte).
- Endpoints REST non exercés contre un vrai GitLab / GitHub (mockés dans tous les tests).
- La file n'est traitée qu'en dehors de `NODE_ENV=test` (comme `SyncScheduler`) ; les e2e appellent `processDue()`.

## Décisions
### Prises en autonomie
- Colonne `since` nullable plutôt que table de curseurs → ALTER simple — réversible : oui
- `created` confirmé dès l'enfilement (acteur = auteur, date = `createdAt`) → exact sans appel forge — réversible : oui
- Valeurs du provisoire conservées à la confirmation → évite de dégrader le nom complet — réversible : oui
- Cadence 10 s, lot de 2, 5 tentatives → valeurs prudentes — réversible : oui
### Arbitrées par l'humain
- Voir `docs/features/US-033-historique-modifications/specs.md` §Décisions
