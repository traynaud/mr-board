# TECH-002 — Initialisation du frontend Angular + Angular Material

Date : 2026-09-11

## Ce qui a été mis en place

- Projet `frontend/` généré avec `@angular/cli` 21.2 (SCSS, sans SSR, strict), `tsconfig` renforcé (`noUnusedLocals`, `noUnusedParameters`, `resolveJsonModule`)
- Angular Material 21 + CDK (`ng add`, thème custom, animations), `@ngrx/signals` 21, `angular-eslint` 21
- Thème Material M3 aligné sur le design system Modernist (`src/styles.scss`) : palette générée depuis `#ec3013` (`src/_theme-colors.scss`, schematic `@angular/material:theme-color`), Archivo (Google Fonts), tokens `--color-*`, `--space-*`, `--shadow-*`, tous les `--mat-sys-corner-*` à 0, surfaces du design system, focus ring accent
- i18n custom (`core/i18n`) : `TranslateService` (chargement de `public/i18n/fr.json` via `provideAppInitializer`), `TranslatePipe` impur, fonctions pures `lookupTranslation` / `interpolateTranslation`, helpers de test `provideI18nTesting()` et `t()` qui lisent le vrai `fr.json` (une clé absente fait échouer le test)
- HTTP : `provideHttpClient(withInterceptors([...]))` avec `apiBaseUrlInterceptor` (`api://x` → `/api/v1/x`) et `httpErrorInterceptor` (→ `ApiError { status, code, message, i18nKey }`)
- Icônes Lucide inline enregistrées dans `MatIconRegistry` (`shared/icons/provide-icons.ts`) : `<mat-icon svgIcon="settings" />`
- Routing lazy : `/` → `BoardPageComponent`, `/settings` → `SettingsPageComponent`, `**` → `/`. Les deux pages sont des squelettes (toolbar Material, marque, navigation) que US-001 et US-005 rempliront
- `proxy.conf.json` (`/api` → `http://localhost:3000`) branché sur `ng serve`
- Vitest (builder `@angular/build:unit-test`, jsdom) avec seuils de couverture 80 % dans `angular.json` ; 23 tests
- ESLint : `no-explicit-any`, `prefer-on-push-component-change-detection`, `prefer-standalone` en erreur
- `public/changelog.json` initialisé (tableau vide), `README.md` du frontend

## Décisions techniques

### Angular 21 plutôt que 22

Angular 22 (stable au moment de l'init) exige Node ≥ 22.22.3 ; le poste est en Node 22.18.0. Angular 21.2 accepte
Node ≥ 22.12 et propose déjà Vitest par défaut, les signals, `provideAppInitializer`, etc. Toute la chaîne
(Material, CDK, `@ngrx/signals`, `angular-eslint`) est alignée en 21. Montée vers 22 à prévoir après mise à jour de
Node (`/project:puretech upgrade Angular 21 → 22`).

### npm 11 pour l'installation

`npm install` avec npm 10.9.3 échoue sur `Cannot read properties of null (reading 'edgesOut')` (bug Arborist avec
les peer deps de Vitest 4). `npx npm@11 install` fonctionne et produit un `package-lock.json` valide ; les `ng add`
suivants passent. Recommandation : mettre npm à jour globalement (`npm i -g npm@11`).

npm 11 bloque par défaut les scripts d'installation natifs (`@parcel/watcher`, `msgpackr-extract`) : sans effet sur
le build, `ng serve` utilise le repli de surveillance de fichiers.

### Convention `api://`

Les services HTTP écrivent `http.get('api://settings')` ; l'interceptor préfixe avec `environment.apiBaseUrl`
(`/api/v1`). Les assets (`i18n/fr.json`) restent en chemin relatif et ne passent pas par le backend.

## Commandes

```bash
cd frontend
rtk npm start                                  # http://localhost:4200
rtk npm run typecheck && rtk npm run lint && rtk npm run build && rtk npm run test:coverage
```
