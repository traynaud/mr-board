# Rapport de développement — US-038 Filtres de la timeline

## Livré

**Backend** (`modules/history`)
- `GET /api/v1/history` accepte `q`, `type`, `actor`, `project`, `from`, `to` (listes séparées par des virgules ou clés
  répétées, bornées à 100 valeurs ; `q` ≤ 100 caractères). `total` = événements filtrés. 400 sur valeur inconnue ou
  mal formée, ou période inversée (`history.filter.period.invalid`).
- `GET /api/v1/history/actors` : acteurs distincts, triés par nom.
- `domain/history-filter.ts` (fonction pure : normalisation de la recherche, séparation de l'acteur « Inconnu »
  `none`, période) + `HistoryQueryService.applyFilter` (ET entre filtres, OU dans un filtre ; même clause pour la
  page, le total et le curseur).
- Recherche insensible à la casse et aux accents : fonction SQL `mrb_fold` enregistrée via `prepareDatabase`
  (`database/typeorm-options.ts`), qui réutilise `normalizeSearchText` (désormais exportée du domaine de recherche du
  tableau). Jokers `LIKE` échappés.
- Aucune migration, aucune dépendance.

**Frontend**
- `HistoryStore` : `filters`, `activeKeys`, `actorOptions` ; `setSearch`, `toggleType/Actor/Project`, `setPeriod`,
  `addFilter`, `removeFilter`, `clearFilters`, `restoreFilters`, `loadActors` ; dernière requête gagnante (compteur
  de requête) ; un échec de rechargement filtré vide la liste.
- `core/url-state/history-query-params.ts` (URL ⇄ filtres, jours locaux) ; `historyFilterParams` dans
  `HistoryService` (jours locaux → `from` inclus / `to` exclu).
- Composants `history-filter-bar` (recherche + anti-rebond 300 ms, pastilles, « + Ajouter un filtre », « Effacer »),
  `history-filter-pill` (Type / Acteur / Projet), `history-period-pill` (deux `mat-datepicker`).
- Page `/history` : restauration depuis l'URL, recopie des filtres dans l'URL (`replaceUrl`), état « aucun résultat »,
  liste atténuée sous la barre de progression pendant un rechargement, « Effacer les filtres » dans l'état d'erreur.
- i18n fr / en : `history.filters.*` ; libellés de types réutilisés depuis `settings.notifications.types.labels.*`.

## Écarts par rapport au plan / aux docs

| Écart | Raison | Réversible |
|-------|--------|------------|
| Pastilles au style du tableau (bordure neutre, accent à l'ouverture) et non accent-100 de la maquette | cohérence avec la barre du tableau en production, que la maquette dit reprendre | oui |
| Pas de carré de couleur par type dans le menu « Type » | libellés réutilisés des Paramètres ; couleur de type réservée à la ligne de timeline | oui |
| `toggleType/Actor/Project` au lieu d'un `toggleValue` surchargé | les surcharges ne sont pas possibles dans un littéral d'objet | oui |
| Helpers d'URL dans `core/url-state/` et non `features/history/` | dépendance `stores` → `features` évitée | oui |

## Tests
- Backend : unitaires (`history-filter`, `typeorm-options`), e2e `history-filters.e2e-spec.ts` (20 cas : chaque
  filtre, ET/OU, acteur inconnu, accents, numéro, jokers, période, pagination + total, `/actors`, 8 cas 400).
- Frontend : specs du store (course, reset du curseur, annulation), du service, des helpers d'URL, de la barre, des
  deux pastilles et de la page.

## Décisions
### Prises en autonomie
- Voir `archi.md` et `design.md` (aucun arbitrage humain requis) ; écarts ci-dessus — réversible : oui
### Arbitrées par l'humain
- Aucune
