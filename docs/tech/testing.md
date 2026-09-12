# Stratégie de tests

Objectif : une couverture conséquente et utile, orientée règles métier et contrats d'API, exécutable en local et en CI
sans dépendance externe (GitLab est toujours mocké).

---

## 1. Pyramide

| Niveau                    | Outil                                   | Cible                                                                 | Part |
|---------------------------|-----------------------------------------|-----------------------------------------------------------------------|------|
| Unitaire backend          | Jest + `@nestjs/testing`                | Fonctions `domain/`, services (repos et client GitLab mockés), mappers, controllers | 60 % |
| e2e backend               | Jest + `supertest` + SQLite `:memory:`  | Contrats HTTP complets, validation DTO, migrations, synchro avec GitLab mocké | 20 % |
| Unitaire frontend         | Vitest (`ng test`, jsdom)               | Fonctions pures, stores, services HTTP (`HttpTestingController`), composants (`TestBed` + harnesses Material) | 15 % |
| E2E navigateur (plus tard) | Playwright                              | Parcours clés : configurer → synchroniser → filtrer → ouvrir une MR    | 5 %  |

Seuils de couverture (bloquants) : **80 %** lignes / branches / fonctions sur le backend et sur le frontend.
Les fonctions `domain/` visent 100 %.

---

## 2. Backend

### Commandes

```bash
cd backend
rtk npm test                          # unitaires
rtk npm test -- --watch               # unitaires en mode watch
rtk npm test -- merge-requests        # filtre par nom de fichier
rtk npm run test:cov                  # unitaires + couverture (seuil 80 %)
rtk npm run test:e2e                  # e2e (backend/test/*.e2e-spec.ts)
rtk npm run lint
```

### Configuration attendue

- `package.json` → `jest` : `rootDir: src`, `testRegex: .*\.spec\.ts$`, `collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!main.ts', '!**/migrations/**', '!**/*.dto.ts']`, `coverageThreshold.global` à 80
- `test/jest-e2e.json` : `testRegex: .e2e-spec.ts$`, `setupFiles` positionnant `DB_PATH=:memory:` et `APP_SECRET=test-secret`
- `test/utils/create-test-app.ts` : construit l'application avec `Test.createTestingModule({ imports: [AppModule] })`, applique les mêmes pipes/filtres que `main.ts`, exécute les migrations sur `:memory:`, remplace `GitlabClientService` par un mock (`overrideProvider`)
- `test/utils/gitlab-fixtures.ts` : jeux de données GitLab réalistes (MR draft / ready / approuvée / sans reviewer…)

### Règles

- Un `*.spec.ts` à côté de chaque fichier de code (service, controller, fonction pure, mapper)
- Nommage : `describe('DifficultyCalculator')` / `it('should_return_hard_when_files_exceed_threshold')`
- Pattern AAA (Arrange / Act / Assert), un comportement par test
- Repositories TypeORM mockés en unitaire (`{ provide: getRepositoryToken(Entity), useValue: mockRepo }`) ; jamais de fichier SQLite réel en unitaire
- Temps contrôlé : injecter `ClockService` (ou `jest.useFakeTimers` + `setSystemTime`) pour les calculs de délai
- Chaque critère d'acceptation Gherkin des specs a un test nommé d'après le scénario
- Les e2e vérifient : code HTTP, forme du DTO (pas de champ inattendu, jeton jamais présent), erreurs 400 sur payload invalide, 404 sur id inconnu, 502 sur GitLab en erreur
- Aucun test ne dépend de l'ordre d'exécution ; base réinitialisée entre les fichiers e2e

---

## 3. Frontend

### Commandes

```bash
cd frontend
rtk npx ng test --no-watch                        # tous les tests (Vitest, jsdom)
rtk npx ng test --no-watch --coverage             # avec couverture
rtk npx ng test --no-watch --include='**/board/**' # sous-ensemble
rtk npx tsc --noEmit                              # vérification de types
rtk npm run lint
```

### Configuration attendue

- `angular.json` → builder `@angular/build:unit-test` avec `runner: vitest`, `browsers` absent (jsdom)
- `src/test-setup.ts` : `provideZonelessChangeDetection()` si zoneless, enregistrement des icônes SVG, `TranslateService` chargé avec `fr.json` réel (pas de mock des libellés)
- Seuil de couverture 80 % configuré dans la config Vitest (`coverage.thresholds`)

### Règles

- Un `*.spec.ts` par composant, store, service, pipe, directive
- Composants : `TestBed` + **Component Harnesses Angular Material** (`MatChipListboxHarness`, `MatMenuHarness`, `MatTableHarness`…) plutôt que des sélecteurs DOM fragiles quand le composant Material est réellement utilisé ; sélecteurs DOM directs acceptés pour les rendus custom (ex : en-têtes triables US-008, sans `mat-sort-header`)
- Services HTTP : `provideHttpClientTesting()` + `HttpTestingController`, vérification des URL, méthodes et corps
- Stores : tests des `computed` (tri, filtrage, compteurs) et des transitions `loading/error` avec services mockés
- Fonctions pures partagées avec le backend (ex : construction du query string) testées exhaustivement
- Vérifier les libellés via les clés i18n résolues (le `fr.json` est chargé dans les tests)
- Pas de `fixture.detectChanges()` en boucle : utiliser `await fixture.whenStable()` et les harnesses

---

## 4. Tests E2E navigateur (Playwright — phase ultérieure)

- `frontend/e2e/*.spec.ts`, exécution contre un backend démarré avec `DB_PATH=:memory:` et un serveur GitLab mocké (`msw` ou serveur Nest de test)
- Parcours minimaux : paramètres → test connexion → ajout repo → synchro → tableau → filtre → tri → ouverture MR
- Commande : `rtk npx playwright test`

---

## 5. Intégration continue (cible)

Pipeline en deux jobs parallèles :

```bash
# backend
cd backend && npm ci && npm run lint && npm run test:cov && npm run test:e2e && npm run build
# frontend
cd frontend && npm ci && npm run lint && npx tsc --noEmit && npx ng test --no-watch --coverage && npm run build
```

Tout échec de seuil de couverture fait échouer le job.

---

## 6. Definition of Done (tests)

- ☐ Tests unitaires verts, couverture ≥ 80 % sur les fichiers touchés
- ☐ Tests e2e backend verts pour tout nouvel endpoint
- ☐ Chaque scénario Gherkin de l'US a un test nommé d'après lui
- ☐ Cas d'erreur couverts (validation, 404, GitLab indisponible)
- ☐ Aucun test ignoré (`xit`, `skip`) sans justification en commentaire
