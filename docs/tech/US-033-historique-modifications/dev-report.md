# Rapport de livraison — US-033 Détection et journal des modifications

## Backend
**Créés** : `database/migrations/1757602100000-CreateHistory.ts` ; `modules/history/` — `history.module.ts`,
`history.service.ts` (+ spec), `domain/detect-merge-request-changes.ts` (+ spec), `domain/merge-request-snapshot.ts`
(+ spec), `entities/{merge-request-event,history-queue-entry,history-baseline}.entity.ts` ; `test/history.e2e-spec.ts`.
**Modifiés** : `merge-requests.service.ts` (+ `getSnapshots`, spec), `sync/sync.service.ts` (+ spec),
`sync/sync.module.ts`.
**Tests** : 668 unitaires verts, e2e verts (8 nouveaux), lint, `tsc`, build OK. Couverture : `history/` 100 % lignes.

## Frontend
Aucun impact.

## Risques traités
- ✅ FK vers `merge_requests` → aucune (tables autonomes avec instantané), l'historique survit à la suppression physique.
- ✅ Faux `created` à la 1re synchro → baseline silencieuse (`history_baselines`), y compris pour les projets
  existants avant la migration.
- ✅ Une MR = une entrée de file → `UNIQUE (project_id, mr_iid)` + `upsert`.
- ✅ L'historique ne peut pas faire échouer une synchro → `try/catch` + warning ; lecture de l'état précédent idem.
- ✅ Projet supprimé → événements, file et baseline supprimés par cascade (testé en e2e).

## Écarts par rapport au plan
Aucun écart structurant. Précision : `getSnapshots` renvoie `[]` si la lecture de l'état précédent échoue → l'historique
du projet est sauté pour cette synchro (et non une baseline erronée).

## Points d'attention pour la review
- Atomicité partielle (cf. archi.md) : upserts hors transaction, événements + file dans une transaction.
- La file se remplit sans consommateur jusqu'à US-034 (≤ 1 ligne par MR, purgée par cascade).
- Valeurs en JSON texte ; clé d'identité utilisateur = `remoteUserId`.

## Décisions
### Prises en autonomie
- Table `history_baselines` plutôt qu'une colonne sur `projects` → évite ALTER et l'impact sur les mocks — réversible : oui
- Événements provisoires datés de la synchro, acteur null → RG-033-07 — réversible : oui
- Aucun événement `reopened`/`deleted`/`commented` dans cette US → relèvent d'US-034/035 — réversible : oui
### Arbitrées par l'humain
- Voir `docs/features/US-033-historique-modifications/specs.md` §Décisions (acteur/date, catalogue, rétention)
