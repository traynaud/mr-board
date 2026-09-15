# TECH-003 — Montée de version NestJS 11 → 12 et migration du backend en ESM

Date : 2026-09-15

## Contexte

`npm audit` remontait 7 vulnérabilités *high* sur `multer` (dépendance transitive de
`@nestjs/platform-express`), corrigées par un override npm ciblé (`multer` 2.2.0 → 2.4.0) sans toucher à Nest.
Cette montée de version a ensuite été demandée séparément, pour rester à jour sur la famille `@nestjs/*`.

## Ce qui a été fait

- `@nestjs/{common,core,platform-express,testing}` 11.2.3 → 12.0.3, `@nestjs/typeorm` 11.0.3 → 12.0.1,
  `@nestjs/config` 4.0.4 → 12.0.0, `@nestjs/schedule` 6.1.3 → 12.0.2, `@nestjs/serve-static` 5.0.5 → 12.0.0,
  `@nestjs/cli`/`@nestjs/schematics` (dev) → 12.x
- `typescript` 5.7 → 6.0.3 (imposé par `@nestjs/schematics@12`, peer `>=6.0.0`, incompatible avec `typescript-eslint`
  au-delà de `<6.1.0` et avec `ts-jest` au-delà de `<7` — 6.0.3 est la seule version stable satisfaisant les trois)
- **Migration du backend en ESM** (`"type": "module"` dans `package.json`) : `@nestjs/common`/`@nestjs/testing` v12
  sont publiés en ESM pur, ce que Jest ne peut plus `require()` depuis un projet CommonJS
- 448 imports relatifs (137 fichiers) réécrits avec extension `.js` explicite (obligatoire sous
  `moduleResolution: nodenext` + format ESM), via un codemod jetable (non conservé)
- `src/database/typeorm-options.ts` : `__dirname` (inexistant en ESM) remplacé par
  `dirname(fileURLToPath(import.meta.url))`
- `src/config/validation.schema.ts` : `import * as Joi from 'joi'` → `import Joi from 'joi'` (le namespace import ne
  reprenait pas les propriétés de l'export CJS de Joi sous l'interop ESM natif de Node — plantait au runtime,
  invisible en `tsc`/tests, détecté par un smoke-test de démarrage réel de l'app compilée)
- Jest en mode ESM (`node --experimental-vm-modules`, `extensionsToTreatAsEsm`, `ts-jest` avec `useESM: true`,
  `moduleNameMapper` renvoyant les specifiers `.js` vers leur source `.ts`)
- `jest` n'est plus injecté comme global ambiant sous Jest ESM : `src/jest-globals-setup.ts` (unitaires) et
  `test/setup-e2e.ts` (e2e) l'exposent désormais explicitement sur `globalThis`, typé par `@types/jest` (et non par
  `@jest/globals`, dont les génériques plus stricts cassaient l'inférence de `jest.fn().mockResolvedValue(...)` dans
  27 fichiers de tests)
- `database.module.spec.ts` : `jest.mock('node:fs', ...)` (hissé automatiquement sous CJS/babel) remplacé par le
  pattern ESM standard `jest.unstable_mockModule(...)` + `await import(...)` dynamique après l'enregistrement du mock
- `typeorm-ts-node-commonjs` → `typeorm-ts-node-esm` dans les scripts `migration:*`
- `tsconfig.json` : suppression de `baseUrl` (déprécié en TS 6, non utilisé), ajout de `rootDir: "."` (TS 6 exige
  désormais un `rootDir` explicite dès que `outDir`/`declaration` sont définis), ajout de `"types": ["jest", "node"]`
  (TS 6 n'inclut plus automatiquement tous les `@types/*`), ajout d'un `paths` pour `supertest/types` (le sous-chemin
  n'est plus résolu par la résolution ESM stricte faute d'`exports` dans `@types/supertest`) ; `tsconfig.build.json`
  définit son propre `rootDir: "./src"` (le `.` du tsconfig racine couvre aussi `test/`, nécessaire pour que
  `tsc --noEmit -p tsconfig.json` et `ts-jest` (programme par fichier) restent valides sans violer `rootDir` sur les
  fichiers e2e)
- `eslint.config.mjs` : `sourceType: 'commonjs'` → `'module'`

## Décisions techniques

### Comportement 404 hors préfixe global — changement accepté

`@nestjs/platform-express@12` (`adapters/express-adapter.js`, `setNotFoundHandler`) ne monte le handler 404 JSON de
Nest que **sous le préfixe global** (`/api/v1/*`), pour supporter plusieurs apps Nest sur un même adaptateur Express.
Une route hors préfixe (ex. `/health` au lieu de `/api/v1/health`) ne passe donc plus par le `HttpExceptionFilter` et
renvoie la page 404 HTML brute d'Express, plutôt que le JSON normalisé `{statusCode, error, message, path,
timestamp}`. Détecté par `test/health.e2e-spec.ts`. **Décision (validée) : accepter ce nouveau comportement** —
aucune route légitime de l'application ne vit hors `/api/v1`. Le test a été mis à jour en conséquence.

### Piège rtk sur ce chantier

Le wrapper `rtk` (filtrage des sorties `tsc`) a masqué des erreurs réelles à plusieurs reprises pendant cette
migration (`TS6059`, notamment). Pour toute vérification `tsc`/build critique sur un changement structurant de ce
type, préférer `npx tsc --noEmit` / `npx nest build` en direct, au moins en vérification finale.

## Vérifications

Backend : `lint` ✅, `tsc --noEmit` ✅, `build` ✅, 633 tests unitaires ✅, 162 tests e2e ✅, couverture ≥ seuils,
smoke-test de démarrage réel (`node dist/main.js` + `GET /api/v1/health`) ✅. Frontend non impacté.
