# MR Board — Backend

API NestJS 11 + SQLite (TypeORM / better-sqlite3). Conventions : `../docs/tech/architecture-backend.md`, tests : `../docs/tech/testing.md`.

## Démarrage

```bash
cp .env.example .env        # puis renseigner APP_SECRET
npm install
npm run start:dev           # http://localhost:3000/api/v1/health
```

## Scripts

| Script                    | Rôle                                            |
|---------------------------|-------------------------------------------------|
| `npm run start:dev`       | Serveur en mode watch                           |
| `npm run build`           | Compilation dans `dist/`                        |
| `npm run lint`            | ESLint (strict, `no-explicit-any` en erreur)    |
| `npm test`                | Tests unitaires (Jest)                          |
| `npm run test:cov`        | Couverture, seuil 80 %                          |
| `npm run test:e2e`        | Tests e2e (supertest, SQLite `:memory:`)        |
| `npm run migration:generate -- src/database/migrations/<Nom>` | Génère une migration depuis les entités |
| `npm run migration:run`   | Applique les migrations (aussi fait au démarrage) |
| `npm run migration:revert`| Annule la dernière migration                    |

## Variables d'environnement

Voir `.env.example`. `APP_SECRET` est obligatoire (chiffrement du jeton GitLab).
