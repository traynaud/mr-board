# Rapport dev — US-037 Page Historique

## Backend
- `GET /api/v1/history?limit&cursor` : `HistoryController`, `HistoryQueryService`, `domain/history-cursor.ts`,
  `dto/history-query.dto.ts`, `dto/history-response.dto.ts` (valeurs old/new désérialisées).
- Aucune migration (index `IDX_mr_events_occurred_at` existant).
- Tests : `history-cursor.spec.ts` (unit), `test/history-timeline.e2e-spec.ts` (8 e2e : vide, tri, pagination sans trou,
  acteur inconnu, 400 sur `limit`/`cursor` invalides).

## Frontend
- Modèle `history.model.ts`, `HistoryService`, `HistoryStore` (load / loadMore, erreur en clé i18n).
- `features/history/` : `HistoryPageComponent`, `HistoryEventRowComponent`, fonctions pures `describe-event.ts`, `group-by-day.ts`.
- Route `/history` (lazy), bouton « Historique » dans la toolbar du tableau, icône Lucide `history`, clés i18n fr/en.
- 40 tests ajoutés (service, store, fonctions pures, ligne, page, toolbar).

## Résultats
Backend : 789 unitaires, 194 e2e, lint/build OK. Frontend : 886 tests, tsc/build OK.

## Décisions
### Prises en autonomie
- Lignes en `div role="listitem"` (hôte du composant) plutôt que `li` → évite un `ul > app-x > li` invalide — réversible : oui
- Erreur de « Charger plus » : bandeau sous la liste, événements conservés — réversible : oui
- `disappeared` sans nom d'acteur dans la phrase — réversible : oui
### Arbitrées par l'humain
- Maquette → validée telle quelle
