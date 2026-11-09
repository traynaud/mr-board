# Rapport de livraison — US-035 Clôtures, fusions et MRs introuvables

## Backend
**Créés** : migration `AddHistoryQueueKind` ; `forges/types/forge-merge-request-state.ts` ;
`gitlab/mappers/map-gitlab-merge-request-state.ts`, `github/mappers/map-github-pull-state.ts` ;
`history/domain/build-terminal-event.ts` (+ specs).
**Modifiés** : `ForgeClient` (+ `fetchMergeRequestState`), `GitlabClientService`, `GithubClientService`,
`HistoryService` (réécrit : disparitions, `reopened`, `kind` collant), `HistoryEnrichmentService` (état terminal,
repli `disappeared`), entité `history_queue` (`kind`), `test/history.e2e-spec.ts`.
**Tests** : 768 unitaires, e2e verts (history : 15), lint / `tsc` / build OK. Couverture globale 98,9 % lignes.

## Frontend
Aucun impact.

## Risques traités
- ✅ MR disparue → entrée `disappeared` (instantané titre / URL), uniquement après une synchro de projet réussie.
- ✅ `merged` / `closed` datés et attribués par la forge ; 404 → `deleted` ; encore ouverte → aucun événement.
- ✅ Idempotence : `state:<état>:<date>` / `deleted:<iid>:<requested_at>` + `OR IGNORE`.
- ✅ Une clôture n'est jamais perdue : `disappeared` collant, repli `disappeared` après 5 échecs.
- ✅ `reopened` à la place de `created` quand le dernier événement connu est `merged` / `closed`.
- ✅ Projet supprimé : file et historique supprimés par cascade (aucune bascule `enabled` n'existe aujourd'hui).

## Écarts par rapport au plan
Aucun.

## Points d'attention pour la review
- `reopened` reste provisoire (acteur inconnu) : aucun signal forge pour la réouverture dans US-034/035.
- Limite : si la clôture est encore en file au moment de la réouverture, l'événement est `created`, pas `reopened`.
- GitHub : une fermeture sans fusion coûte 2 appels (`pulls` + `issues` pour `closed_by`).
- GitLab : `merge_user` lu en premier, `merged_by` (déprécié) en repli. Non éprouvé sur une instance réelle.

## Décisions
### Prises en autonomie
- Appel d'état dédié plutôt que la timeline → une seule source par événement terminal — réversible : oui
- `disappeared` collant → ne jamais perdre une clôture — réversible : oui
- `reopened` déduit du dernier événement connu → pas de signal forge disponible — réversible : oui
### Arbitrées par l'humain
- Voir `docs/features/US-033-historique-modifications/specs.md` §Décisions
