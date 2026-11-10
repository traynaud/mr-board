# Architecture — US-038 Filtres de la timeline

## Résumé fonctionnel
> `GET /api/v1/history` accepte des filtres (recherche, types, acteurs, projets, période) appliqués en SQL ; un second
> endpoint liste les acteurs distincts pour alimenter le menu « Acteur ». La page `/history` gagne une barre de filtres
> dont l'état est reflété dans l'URL. Aucun changement de schéma, aucune nouvelle dépendance.

## Backend (`modules/history`)

### API
- `GET /api/v1/history?limit&cursor&q&type&actor&project&from&to` — mêmes paramètres que l'URL du front, listes
  séparées par des virgules. `total` = nombre d'événements **filtrés** (RG-038-11), curseur inchangé.
  - `q` : texte, `@MaxLength(100)`.
  - `type` : liste de types du catalogue (`@IsIn(HISTORY_EVENT_TYPES, { each: true })`).
  - `actor` : liste de `username` ; la valeur réservée `none` = « Inconnu » (`actor_username IS NULL`).
  - `project` : liste d'entiers.
  - `from` / `to` : instants ISO-8601 ; `from` **inclus**, `to` **exclu** (le front envoie le début du lendemain local).
  - Chaque liste est bornée à 100 valeurs (`@ArrayMaxSize(100)`). Toute valeur invalide → 400 (RG-038-04, ValidationPipe
    global) ; `from > to` → `BusinessValidationException('history.filter.period.invalid')` (400).
- `GET /api/v1/history/actors` → `HistoryActorOptionDto[]` `{ username, name, avatarUrl }` : acteurs distincts
  (`actor_username IS NOT NULL`), triés par nom puis username. Route déclarée **avant** tout paramètre de chemin.

### Découpage
- `dto/history-query.dto.ts` : étendu (champs ci-dessus, `@Transform` pour découper les listes `a,b` — les tableaux
  répétés `?type=a&type=b` sont aussi acceptés).
- `domain/history-filter.ts` *(pure, testée)* : `HistoryFilter` normalisé (`terms`, `iid`, `types`, `actors`,
  `includeUnknownActor`, `projectIds`, `from`, `to` en `toISOString()`), `buildHistoryFilter(dto)` (lève sur période
  inversée), `likePattern(term)` (échappe `%`, `_`, `\`).
- `history-query.service.ts` : méthode privée `applyFilters(qb, filter)` partagée par la page, le `total` (comptage avec
  les mêmes filtres, **sans** curseur) et l'endpoint d'acteurs (`listActors()`). Le `count()` actuel devient
  `getCount()` du même query builder.
- `history.controller.ts` : `@Get('actors')`.

### Recherche insensible aux accents (RG-038-05)
SQLite ne sait pas replier les accents. Choix : **fonction SQL utilisateur** `mrb_fold(text)` enregistrée à l'ouverture de
la base via l'option `prepareDatabase` de TypeORM `better-sqlite3` (`buildTypeOrmOptions`). Elle appelle la même
normalisation que la recherche du tableau (NFD, suppression des diacritiques, minuscules) :
- `normalizeSearchText` est **exportée** depuis `merge-requests/domain/search-merge-requests.ts` et réutilisée (pas de
  seconde implémentation à garder cohérente). `compileSearch` (termes + `iid`) est réutilisé tel quel.
- Clause : `(mrb_fold(e.mr_title) LIKE :t0 ESCAPE '\' AND … ) OR e.mr_iid = :iid` ; paramètres liés, jamais concaténés.
- Coût : parcours complet du journal pour une recherche (fonction non indexable). Acceptable : la table est bornée par
  la rétention (US-036) et la recherche est la seule requête concernée. Repli documenté si besoin : colonne
  `mr_title_folded` + index (migration), non retenue.
- Les filtres `type`, `project`, `actor`, `from/to` s'appuient sur les index existants `IDX_mr_events_type_occurred_at`,
  `IDX_mr_events_project_occurred_at`, `IDX_mr_events_occurred_at` ; `actor_username` n'est pas indexé (table bornée, pas
  de migration).

### Points de vigilance
- Comparaisons de dates en texte : valides car `occurred_at` est en `toISOString()` (point déjà noté par US-037) ;
  `from`/`to` sont renormalisés via `new Date(x).toISOString()` avant la requête.
- `prepareDatabase` doit s'exécuter pour la base fichier **et** les tests e2e (même `buildTypeOrmOptions`) : vérifié par
  un test d'intégration de `mrb_fold`.
- Cascade : les événements d'un projet supprimé disparaissent avec lui (FK `ON DELETE CASCADE`), le filtre Projet n'a donc
  pas de cas « projet supprimé ».

## Frontend

### Modèle et fonctions pures
- `models/history.model.ts` : `HistoryFilters { search; types; actors; projects; from; to }`, `HistoryFilterKey =
  'type' | 'actor' | 'project' | 'period'`, `HistoryActorOption`, `UNKNOWN_ACTOR = 'none'`.
- `features/history/history-filters.ts` *(pures, testées)* : `decodeHistoryQuery(params)` (écarte les types inconnus et
  dates mal formées, RG-038-14), `encodeHistoryQuery(state)` (omet les filtres vides), `toApiParams(filters)` (jours
  locaux → instants ISO, RG-038-09), `hasAnyFilter`.

### Service / store
- `HistoryService.getHistory(cursor, limit?, filters?)` + `getActors()`.
- `HistoryStore` : état `filters`, `activeKeys` (pastilles affichées même sans valeur, RG-038-12), `actorOptions` ;
  méthodes `setFilters(patch)` (réinitialise liste + curseur puis recharge), `addFilter(key)`, `removeFilter(key)`,
  `clearFilters()`, `loadActors()`. **Dernière requête gagnante** (RG-038-10) : un compteur de requête incrémenté à
  chaque `load()` ; la réponse n'est appliquée que si son numéro est encore le courant (idem `loadMore`, abandonné si le
  jeton a changé).
- Debounce de la recherche (300 ms) porté par le composant de barre (comme le tableau, RG-026-09).

### Composants (`features/history/`)
| Composant | Rôle |
|-----------|------|
| `history-filter-bar` | Présentationnel : recherche, pastilles actives, « + Ajouter un filtre », « Effacer » (reçoit l'état, émet des intentions) |
| `history-filter-pill` | Pastille + menu à cases à cocher (Type / Acteur / Projet) : `options: {value,label,sublabel?,swatch?}[]`, `selected`, `toggle`, `remove` |
| `history-period-pill` | Pastille + menu à deux `mat-datepicker` (Du / Au), `provideNativeDateAdapter()`, locale issue de `TranslateService` |
- **Pas de réutilisation directe de `FilterPillComponent`** : il est couplé aux `FilterKey` du tableau, aux facettes avec
  compteurs et aux clés `board.filters.pills.*`. Le style (pastille accent, croix, filet) est repris par tokens. Dette
  assumée : factoriser le SCSS des pastilles dans une feuille partagée (suggestion).
- `HistoryPageComponent` : initialise le store depuis `ActivatedRoute.snapshot.queryParamMap` (`decodeHistoryQuery`),
  recopie l'état du store dans l'URL (`router.navigate([], { queryParams, replaceUrl: true })`, `queryParamsHandling`
  vide pour les clés absentes), charge acteurs et projets, ajoute l'état « aucun résultat » et le rechargement atténué.
- Icônes existantes (`x`, `chevron-down`, `plus`, `alert-circle`) ; ajouter `calendar` si absente.
- i18n : clés `history.filters.*` (fr + en, parité testée).

## Tests prévus
- Backend : unitaires `history-filter` (période inversée, échappement LIKE, normalisation), service (chaque filtre, ET/OU,
  `total` filtré, curseur + filtres, acteur `none`), fonction `mrb_fold` ; e2e `history.e2e-spec.ts` étendu
  (cas des critères d'acceptation, 400 sur type inconnu / période inversée, `/history/actors`).
- Frontend : fonctions pures URL, store (dernière requête gagnante, reset du curseur), barre, pastilles, période, page
  (restauration depuis l'URL, aucun résultat, effacer).

## Décisions
### 🛑 Arbitrage humain requis
Aucun : pas de migration (D4), pas de nouvelle dépendance, pas de contrat d'API public tiers (l'API n'est consommée que par le
front de l'application), aucun secret manipulé (D5).
### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Insensibilité aux accents | fonction SQL `mrb_fold` via `prepareDatabase` | parité avec RG-026 sans migration | oui |
| Réutilisation de la normalisation | export de `normalizeSearchText` depuis le domaine du tableau | une seule implémentation | oui |
| Listes en query | séparées par des virgules (+ tableaux acceptés) | cohérent avec l'URL du tableau | oui |
| Bornes de période | `from` inclus, `to` exclu | évite la conversion « fin de journée » côté API | oui |
| Acteurs | endpoint dédié `/history/actors` | la page chargée est paginée | oui |
| Pastilles | composants dédiés plutôt que `FilterPillComponent` | découplage des `FilterKey` du tableau | oui |
| Dernière requête gagnante | compteur de requête dans le store | évite les courses | oui |
### Arbitrées par l'humain
- Aucune
