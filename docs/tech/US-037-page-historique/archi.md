# Architecture — US-037 Page Historique

## Résumé fonctionnel
> Page `/history` en lecture seule : timeline des événements, du plus récent au plus ancien, paginée par curseur.

## Backend
- **Endpoint** `GET /api/v1/history?limit=<1–200, défaut 50>&cursor=<opaque>` dans `HistoryController`
  (nouveau, `HistoryModule`). Réponse `HistoryResponseDto` :
  `{ events: HistoryEventDto[], nextCursor: string | null, total: number }`.
- **Tri / pagination** : `ORDER BY occurred_at DESC, id DESC` ; curseur = base64url de `<occurredAt>|<id>` ;
  `WHERE occurred_at < :at OR (occurred_at = :at AND id < :id)` ; on lit `limit + 1` lignes pour savoir s'il y a une suite.
  Fonctions pures `domain/history-cursor.ts` (`encodeCursor`, `decodeCursor` → `null` si invalide → 400).
- **DTO d'événement** : `id, occurredAt, type, status, projectId, projectAlias, mrIid, mrTitle, mrWebUrl,
  actor: {username,name,avatarUrl} | null, oldValue, newValue` (valeurs désérialisées du JSON stocké ; texte brut si
  non parsable). Aucune entité exposée.
- **Validation** : `HistoryQueryDto` (`@IsInt @Min(1) @Max(200)` avec `@Type(() => Number)`, `cursor` `@IsString`) ;
  curseur illisible → `BusinessException` 400. US-038 étendra ce DTO (filtres).
- **Index** : `IDX_mr_events_occurred_at` existe déjà (US-033), aucune migration.
- **Lecture seule** : aucune écriture, pas d'impact sécurité (aucun secret dans les événements).

## Frontend
- `models/history.model.ts`, `core/api/history.service.ts` (`getHistory(cursor?, limit?)`),
  `stores/history.store.ts` (`events`, `total`, `nextCursor`, `loading`, `loadingMore`, `error` clé i18n ; `load()`, `loadMore()`).
- `features/history/history-page.component` (smart, lit les stores `HistoryStore`, `ProjectsStore`, `SettingsStore`),
  `history-event-row` (présentation), `describe-event.ts` + `group-by-day.ts` (fonctions pures testées).
- Route `/history` (lazy) ; bouton dans `BoardToolbarComponent`.

## Points de vigilance
- `occurred_at` est du texte ISO : le tri lexicographique n'est exact que si tous les formats sont `toISOString()` (UTC, `Z`) ;
  à vérifier sur les dates issues des forges (mappers).
- La page ne se rafraîchit pas seule (pas de polling) : rechargement à l'ouverture.

## Décisions
### 🛑 Arbitrage humain requis
Aucun.
### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Pagination | curseur `(occurred_at, id)` | stable malgré les insertions | oui |
| `limit` max | 200 | borne la charge | oui |
| Compteur | `total` renvoyé par l'API | affichage toolbar | oui |
| Projet couleur | résolu côté front via `ProjectsStore` | évite un join | oui |
