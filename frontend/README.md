# MR Board — Frontend

Angular 21 + Angular Material 21, `@ngrx/signals`, Vitest. Conventions : `../docs/tech/architecture-frontend.md`,
design : `../docs/tech/design-system.md`, tests : `../docs/tech/testing.md`, i18n : `../docs/tech/i18n.md`.

## Démarrage

```bash
npm install                 # si npm 10.9 échoue (bug Arborist / Vitest 4) : npx npm@11 install
npm start                   # http://localhost:4200 — /api proxifié vers http://localhost:3000
```

## Scripts

| Script                  | Rôle                                                  |
|-------------------------|-------------------------------------------------------|
| `npm start`             | `ng serve` avec `proxy.conf.json`                     |
| `npm run build`         | Build de production dans `dist/frontend`              |
| `npm test`              | Tests unitaires Vitest (jsdom), sans watch            |
| `npm run test:watch`    | Tests en mode watch                                   |
| `npm run test:coverage` | Couverture, seuil 80 % (statements, branches, functions, lines) |
| `npm run lint`          | ESLint (angular-eslint, `no-explicit-any`, OnPush obligatoire) |
| `npm run typecheck`     | `tsc --noEmit` sur app et specs                       |

## Structure

```
public/i18n/fr.json          # tous les libellés
public/changelog.json        # journal des évolutions
src/styles.scss              # thème Material + tokens du design system Modernist
src/_theme-colors.scss       # palette générée depuis #ec3013 (schematic theme-color)
src/app/core/i18n            # TranslateService, TranslatePipe, provideI18n, helpers de test
src/app/core/interceptors    # api-base-url (api://…), http-error (ApiError)
src/app/shared/icons         # icônes Lucide enregistrées dans MatIconRegistry
src/app/features/board       # écran Tableau (/)
src/app/features/settings    # écran Paramètres (/settings)
```

Appels API : `http.get('api://merge-requests')` → `/api/v1/merge-requests` (interceptor). Icônes :
`<mat-icon svgIcon="settings" />`.
