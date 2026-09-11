# TECH-001 — Initialisation du backend NestJS + SQLite

Date : 2026-09-11

## Ce qui a été mis en place

- Projet `backend/` généré avec `@nestjs/cli` 11 (`--strict`), `tsconfig` renforcé (`strict`, `noUnusedLocals`, `noUnusedParameters`)
- Dépendances : `@nestjs/typeorm`, `typeorm`, `better-sqlite3`, `@nestjs/config` + `joi`, `@nestjs/schedule`, `class-validator`, `class-transformer`, `helmet`, `dotenv`
- `src/config/` : configuration typée (`AppConfig`) + schéma Joi validant les variables d'env au démarrage (`APP_SECRET` obligatoire)
- `src/database/` : options TypeORM partagées (`synchronize: false`, `migrationsRun: true`), `DataSource` CLI, dossier `migrations/`, création automatique du dossier du fichier SQLite
- `src/common/` : exceptions métier typées avec `code` stable, filtre global normalisant les erreurs (`{ statusCode, error, message, code?, timestamp, path }`), masquage des erreurs 500
- `src/app.setup.ts` : préfixe `/api/v1`, `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), filtre global — partagé entre `main.ts` et les tests e2e
- `src/modules/health/` : `GET /api/v1/health` → `{ status, database, timestamp }` (vérifie `SELECT 1`)
- Tests : Jest unitaires (seuil 80 % global), e2e (`test/jest-e2e.json`, `setup-e2e.ts` → SQLite `:memory:`), helper `test/utils/create-test-app.ts`
- ESLint : `no-explicit-any`, `no-floating-promises`, `no-unsafe-argument` en erreur ; `npm run lint` sans `--fix`
- `.env.example` documenté, `README.md` du backend

## Décisions techniques

### Versions des paquets Nest « satellites »

`npm install` sans contrainte a installé `@nestjs/config@12`, `@nestjs/schedule@12` et `@nestjs/typeorm@12`, qui sont
publiés en **ESM only** (`"type": "module"`). Node 22 les charge sans problème (`require(esm)`), mais Jest 30 en
CommonJS échoue (`Must use import to load ES Module`). Plutôt que de basculer toute la chaîne de test en ESM, les
versions **CommonJS** les plus récentes ont été épinglées :

| Paquet             | Version | Raison                                              |
|--------------------|---------|-----------------------------------------------------|
| `@nestjs/config`   | 4.0.4   | Dernière 4.x (CJS), compatible Nest 11              |
| `@nestjs/schedule` | 6.1.3   | Dernière 6.x (CJS), compatible Nest 11              |
| `@nestjs/typeorm`  | 11.0.3  | CJS, peer `typeorm ^0.3 || ^1.0`                    |
| `typeorm`          | 1.1.1   | CJS, driver `better-sqlite3` ^12                    |

À revoir lors d'une montée vers NestJS 12 (passage en ESM de l'ensemble, ou Node ≥ 24.9 où Jest supporte `require(esm)`).

### Autres choix

- `database.module.ts` porte la fonction `ensureDatabaseDirectory` (testée) ; les fichiers `*.module.ts` sont exclus de la couverture
- Le `HttpExceptionFilter` renvoie `error` en libellé HTTP (`Bad Request`) pour les exceptions Nest et en constante (`NOT_FOUND`) pour les exceptions métier construites avec `HttpStatus[status]` — harmonisation possible plus tard si le frontend en a besoin (il s'appuie sur `code`)
- Aucune migration n'est créée à ce stade (pas d'entité) ; la première arrivera avec US-001 (`settings`)

## Commandes

```bash
cd backend
cp .env.example .env            # renseigner APP_SECRET
rtk npm run start:dev           # http://localhost:3000/api/v1/health
rtk npm run lint && rtk npm run build && rtk npm test && rtk npm run test:e2e
rtk npm run migration:generate -- src/database/migrations/AddSettings
```
