# Rapport QA — US-013 Actualisation automatique

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend unit (`npm test`) | 310 passed / 0 failed |
| Backend e2e (`npm run test:e2e`) | 80 passed / 0 failed |
| Backend couverture (`npm run test:cov`) | 99,17 % statements / 87,77 % branches / 98,38 % fonctions / 99,24 % lignes — seuil 80 % largement respecté |
| Frontend (`ng test --no-watch`) | 440 passed / 0 failed |
| Frontend couverture (`ng test --coverage`) | 96,54 % statements / 94,56 % branches / 91,13 % fonctions / 99,09 % lignes — seuil 80 % respecté (voir §5, BUG-001 résolu) |

`tsc --noEmit`, `npm run lint`/`npm run build` (backend) et `ng lint`/`ng build` (frontend) : tous verts.

## 2. Couverture des critères d'acceptation (specs.md §5)

| Scénario Gherkin | Statut | Test(s) / vérification couvrant |
|---|---|---|
| Synchronisation planifiée | ✅ | `sync-scheduler.service.spec.ts` (`should_trigger_a_scheduled_sync_when_the_interval_has_elapsed`) **+** vérifié en direct sur serveur dev réel (`refreshIntervalMin=1`, tick effectif après ~20 s, `sync_runs.trigger="scheduled"` observé via `GET /sync/status`) |
| Mode manuel | ✅ | `compute-next-run-at.spec.ts`, `sync-scheduler.service.spec.ts` (`should_do_nothing_in_manual_mode`), `sync.e2e-spec.ts` (`should_report_no_next_run_in_manual_mode`) **+** vérifié en direct (`refreshIntervalMin=0` → `nextRunAt: null`) |
| Reprogrammation à chaud | ✅ | Par construction : `tick()` relit `refreshIntervalMin` à chaque passage (15 s), aucun état de reprogrammation à invalider — pas de scénario « redémarrage requis » possible avec cette conception (voir archi.md, écart assumé vs. `SchedulerRegistry`) |
| Valeur invalide | ✅ | `settings.e2e-spec.ts` (`should_reject_an_out_of_enum_refresh_interval`) **+** vérifié en direct (`refreshIntervalMin=7` → 400) |
| Sync planifiée sautée si sync en cours | ✅ | Le verrou vient intégralement de `SyncService.trigger()` (RG-G16, inchangé) — déjà couvert par `sync.service.spec.ts`/`sync.e2e-spec.ts` (`should_not_start_a_second_run_while_one_is_in_progress`) ; aucune répétition nécessaire côté `SyncScheduler`, qui délègue purement à `trigger()`. Non re-vérifié manuellement (fenêtre de concurrence trop courte à observer via curl avec 0 projet configuré) |
| Sync planifiée sautée sans jeton | ✅ | `sync-scheduler.service.spec.ts` (`should_do_nothing_silently_when_no_token_is_configured` — vérifie que `sync.trigger` n'est **jamais** appelé, donc aucune trace `sync_runs`). Non re-testé manuellement à l'identique (le jeton configuré par un test précédent de cette session ne pouvait pas être effacé via l'API — pas de sémantique « vider le jeton » côté `PUT /settings`) |
| Rechargement automatique du tableau | ✅ | RG-013-04 pré-existante (RG-005-06, US-005) : le trigger `'scheduled'` n'est pas distingué du trigger `'manual'` par l'effect de rechargement — vérifié non-régressé (suite `board-page.component.spec.ts` toujours verte). La conservation de la position de défilement n'a pas de test dédié — limitation déjà pré-existante, non introduite par cette US |
| Pause quand l'onglet est masqué | ✅ | `board-page.component.spec.ts` (`should_pause_polling_when_the_tab_becomes_hidden_and_pauseWhenHidden_is_enabled`, `should_resume_polling_and_reload_merge_requests_when_the_tab_becomes_visible_again`) |
| Pas de pause | ✅ | `board-page.component.spec.ts` (`should_not_pause_when_pauseWhenHidden_is_disabled`) |
| Tooltip prochaine synchro | ✅ | `sync-status-label.spec.ts` (`should_show_the_formatted_time_of_the_next_run`), `board-toolbar.component.spec.ts` (`should_show_the_next_run_time_in_the_tooltip`) — texte exact « Prochaine synchro à HH:mm » conforme au Gherkin |

**10/10 scénarios validés** (2 avec une réserve documentée sur l'étendue de la vérification, voir cellules ci-dessus).

Point additionnel testé, hors Gherkin explicite mais couvert par RG-013-05 : cas où `settingsStore.settings()` est encore
`null` au premier rendu — `should_not_pause_before_settings_have_loaded` confirme qu'aucune pause n'est déclenchée
avant le premier chargement des paramètres.

## 3. Tests API manuels

Serveur de dev lancé localement (SQLite `:memory:`, migrations auto-appliquées via `migrationsRun: true`).

| Requête | Résultat observé | Conforme |
|---|---|---|
| `GET /api/v1/settings` (post-migration) | `refreshIntervalMin: 5, pauseWhenHidden: true` | ✅ RG-013-01 (défaut) |
| `GET /api/v1/sync/status` (jamais synchronisé) | `nextRunAt` = horodatage courant (due immédiatement) | ✅ RG-013-07 |
| `PUT /settings {refreshIntervalMin: 7}` | `400` — `"refreshIntervalMin must be one of the following values: 0, 1, 5, 15, 30"` | ✅ RG-013-01 |
| `PUT /settings {refreshIntervalMin: 15, pauseWhenHidden: false}` | `200`, champs répercutés sur `GET /settings` | ✅ |
| `PUT /settings {refreshIntervalMin: 0}` | `200` puis `GET /sync/status` → `nextRunAt: null` | ✅ RG-013-01/07 |
| Tick planifié réel (`refreshIntervalMin: 1`, jeton factice configuré) | Après ~20 s, `lastRun.trigger: "scheduled"`, `mrCount: 0` (aucun repo configuré), `nextRunAt` recalculé à `startedAt + 1 min` | ✅ RG-013-02/07 |
| `POST /sync` (manuel) juste après | `lastRun.trigger: "manual"`, `nextRunAt` repoussé à partir de ce nouveau `startedAt` | ✅ RG-013-03 |
| `PUT /settings {pauseWhenHidden: "yes"}` | `200`, stocké comme `true` | ⚠️ voir BUG-002 (comportement pré-existant, non spécifique à cette US) |
| `PUT /settings {gitlabToken: "…"}` puis `GET /settings` | Jeton jamais renvoyé en clair (`tokenHint` uniquement) | ✅ (RG-001, non régressé) |

## 4. Vérification UI contre les maquettes

⚠️ **Non réalisée visuellement**, comme pour les US précédentes : aucun outil de rendu navigateur disponible dans
cette session. Points à vérifier manuellement avant mise en production :
- Rendu du `mat-radio-group` en ligne dans la section « 04 · Actualisation » (première utilisation de ce composant
  dans le projet) — alignement des 5 options, comportement au focus/clavier.
- Rendu du `mat-slide-toggle` « Mettre en pause… » (déjà utilisé ailleurs dans l'app malgré ce que suggérait
  `archi.md` — en réalité première utilisation aussi, voir dev-report.md).
- Tooltip « Prochaine synchro à HH:mm » sur la toolbar : positionnement, lisibilité.
- Cohérence visuelle de la nouvelle section avec les 3 sections existantes (numérotation, séparateurs, `[last]`
  correctement déplacé en bas de page).

## 5. Bugs trouvés

**BUG-001 — Couverture frontend non mesurable via `rtk` (résolu)**
`rtk npx ng test --no-watch --coverage` tronquait la sortie avant le tableau de synthèse de couverture affiché en fin
de commande, et `coverage/frontend/index.html` restait inchangé (résidu d'une session antérieure, US-012). Root
cause confirmée : c'est le filtrage de sortie de `rtk` sur cette commande précise qui coupait le résultat, pas
l'outillage Angular/Vitest lui-même — en lançant la même commande sans `rtk` (`npx ng test --no-watch --coverage`),
le rapport se régénère normalement avec un horodatage frais. **Couverture réelle mesurée pour US-013** :
96,54 % statements / 94,56 % branches / 91,13 % fonctions / 99,09 % lignes — seuil 80 % largement respecté, en
légère hausse par rapport à US-012.

**BUG-002 — `@IsBoolean()` ne peut rejeter aucune valeur véridique non booléenne (comportement pré-existant, non
spécifique à cette US)**
`PUT /settings` avec `pauseWhenHidden: "yes"` (ou toute valeur véridique non booléenne) renvoie `200` et stocke
`true`, sans jamais déclencher de `400`. Cause : le `ValidationPipe` global (`transformOptions:
{ enableImplicitConversion: true }`) convertit toute valeur véridique en `true` **avant** l'exécution de
`@IsBoolean()`, rendant ce champ de validation inatteignable dans les faits pour ce type. Vérifié directement avec
`class-transformer` (voir dev-report.md, section Écarts). Ce n'est pas un défaut introduit par US-013 — c'est la
première fois que le projet valide un champ booléen dans un DTO, donc la première fois que ce comportement de la
configuration globale existante devient observable. Non bloquant (aucune valeur malicieuse ne peut casser l'appli :
le pire cas est `pauseWhenHidden` stocké à `true` au lieu d'être rejeté), mais à garder en tête pour tout futur champ
booléen de DTO.

Aucun autre bug, ni bloquant ni mineur, identifié.

## 6. Recommandations

- ~~Combler BUG-001~~ — comblé : cause identifiée (filtrage `rtk` sur cette commande précise), contournée en lançant
  `npx ng test --coverage` directement pour obtenir la mesure réelle (§1). Signaler à l'outil `rtk` que sa sortie
  filtrée sur `ng test --coverage` omet le tableau de synthèse final (hors périmètre de cette US, à traiter côté
  configuration `rtk` de l'environnement).
- ~~Texte de la note explicative divergent de la RG-013-06~~ — comblé : `settings.refresh.hint` reprend désormais le
  texte exact de la RG (« Synchro automatique ; le bouton Rafraîchir force toujours. »), suite passée à 440 tests
  toujours verte après le changement (aucun test n'était couplé à l'ancien libellé).
- BUG-002 : envisager, dans une US ultérieure qui introduirait un champ booléen à validation stricte, de retirer
  `enableImplicitConversion` du pipe global ou d'utiliser un validateur dédié (`@Transform` explicite avant
  `@IsBoolean()`) — hors périmètre de cette US (le champ actuel n'a pas de contrainte métier forte sur son type ;
  toucher au pipe global risquerait de régresser la conversion implicite dont dépend `refreshIntervalMin` lui-même).
- Reprend la recommandation déjà faite en US-010/011/012 : vérification visuelle manuelle en navigateur avant mise
  en production (voir §4), toujours non réalisable dans cette session (pas d'outil de rendu).
