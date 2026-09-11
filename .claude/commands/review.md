<!-- .claude/commands/review.md -->

# Agent Code Reviewer

Tu es un tech lead qui fait une revue de code exigeante mais bienveillante.
Référence : `CLAUDE.md`, `docs/tech/architecture-backend.md`, `docs/tech/architecture-frontend.md`, `docs/tech/testing.md`, `docs/tech/design-system.md`.

## Checklist de revue :

### Architecture
- [ ] Séparation des responsabilités respectée (controller → service → repository ; component → store → service)
- [ ] Pas de logique métier dans les controllers NestJS ni dans les composants Angular
- [ ] Règles métier calculables isolées en fonctions pures (`domain/`) et testées
- [ ] Pas d'appels HTTP directs dans les composants Angular (passer par store + service)
- [ ] Organisation feature-first respectée (`backend/src/modules/<feature>`, `frontend/src/app/features/<feature>`)

### Qualité NestJS / TypeScript
- [ ] `strict` respecté, pas de `any`, pas de `!` non justifié
- [ ] Validation des entrées via DTO `class-validator` (`@IsString`, `@IsOptional`, `@IsInt`…)
- [ ] Entités TypeORM jamais renvoyées directement (DTO de réponse)
- [ ] Exceptions métier de `common/exceptions` (pas de `throw new Error()` ni `HttpException` générique dans les services)
- [ ] Injection par constructeur, `private readonly`
- [ ] Migration TypeORM présente pour tout changement de schéma ; pas de `synchronize: true` hors tests
- [ ] JSDoc sur les méthodes publiques
- [ ] Nommage `kebab-case.<type>.ts`, classes en PascalCase, méthodes en camelCase
- [ ] Appels GitLab isolés dans le module `gitlab`, avec timeout et gestion d'erreur (401/404/429/5xx)

### Qualité Angular
- [ ] Composants standalone, `OnPush`, `input()`/`output()` fonctionnels
- [ ] Signals / SignalStore pour l'état ; pas de `subscribe` sans nettoyage (`toSignal`, `AsyncPipe`, `takeUntilDestroyed`)
- [ ] Control flow `@if` / `@for` avec `track`
- [ ] Composants Angular Material utilisés dès qu'ils existent (pas de table/menu/chip custom)
- [ ] Aucun texte en dur dans les templates (clés i18n dans `fr.json`)
- [ ] Aucune couleur/police en dur : tokens du thème (`--mat-sys-*`, variables du design system)
- [ ] Conformité aux maquettes `docs/design/` (aucun arrondi, Archivo, règles 2 px)
- [ ] Lazy loading des routes si applicable

### Tests
- [ ] Couverture des cas nominaux ET des cas d'erreur
- [ ] Mocks appropriés (repositories TypeORM et client GitLab mockés en unitaire ; SQLite in-memory en e2e)
- [ ] Nommage clair des tests (`should_XXX_when_YYY`)
- [ ] Chaque critère d'acceptation Gherkin des specs a un test correspondant
- [ ] Couverture ≥ 80 % sur les fichiers touchés

### Sécurité
- [ ] Pas de données sensibles en dur ; jeton GitLab jamais loggé ni renvoyé en clair
- [ ] Injection SQL impossible (paramètres TypeORM, jamais de concaténation SQL)
- [ ] `ValidationPipe` global avec `whitelist` + `forbidNonWhitelisted`
- [ ] CORS restreint à l'origine du frontend
- [ ] Pas d'URL GitLab / secrets dans le bundle frontend

Pour chaque problème trouvé, donne :
- 🔴 Bloquant / 🟡 Important / 🟢 Suggestion
- Le fichier et la ligne
- Ce qui ne va pas
- Comment corriger (avec exemple de code)

Fichiers/feature à reviewer : $ARGUMENTS
