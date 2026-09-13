# Docker — MR Board en un seul container

## Principe

Une seule image (`Dockerfile` à la racine) construit le frontend Angular et l'API NestJS, puis exécute **un seul
process Node** : NestJS sert l'API sur `/api/v1` et le build Angular sur `/` grâce à `@nestjs/serve-static`
(`backend/src/static/static.module.ts`). Frontend et API partagent donc la même origine, comme prévu par
`frontend/src/environments/environment.ts` (`apiBaseUrl = '/api/v1'`).

Pas de nginx ni de supervisord : moins de pièces mobiles, un seul port, un seul healthcheck.

## Démarrage

```bash
cp .env.example .env          # renseigner APP_SECRET (>= 16 caractères, ex : openssl rand -hex 32)
docker compose up -d --build  # http://localhost:3000
docker compose logs -f
docker compose down           # la base SQLite est conservée sur l'hôte, dans ./data/mr-board.sqlite
```

## Persistance de la base SQLite

`./data` (racine du projet) est monté en bind mount sur `/app/data` dans le container : le fichier
`data/mr-board.sqlite` vit directement sur l'hôte, visible et sauvegardable comme n'importe quel fichier, et survit
à `docker compose down`, à un `docker rm` du container ou à la suppression de l'image — pas seulement à un
redémarrage. Le dossier est ignoré par Git (`.gitignore`, sauf `.gitkeep`) et par le build (`.dockerignore`,
`**/*.sqlite*`).

> Migration depuis une version antérieure (volume nommé `mr-board-data`) : copier l'ancienne base avant de
> supprimer le volume, par exemple :
> ```bash
> docker compose cp mr-board:/app/data/mr-board.sqlite ./data/mr-board.sqlite
> docker volume rm mr-board_mr-board-data
> ```

## Variables (docker compose)

| Variable        | Défaut                   | Rôle                                                            |
|-----------------|--------------------------|-----------------------------------------------------------------|
| `APP_SECRET`    | *(obligatoire)*          | Clé de chiffrement du jeton GitLab                              |
| `MR_BOARD_PORT` | `3000`                   | Port exposé sur l'hôte                                          |
| `CORS_ORIGIN`   | `http://localhost:3000`  | Origine autorisée par CORS ; doit correspondre à l'URL d'accès  |
| `LOG_LEVEL`     | `log`                    | Niveau de log Nest                                              |

Fixées dans l'image : `DB_PATH=/app/data/mr-board.sqlite` (bind mount `./data`), `STATIC_DIR=/app/public`,
`NODE_ENV=production`. Le container tourne avec l'utilisateur non-root `node`.

## Étapes du Dockerfile

1. `frontend-build` : `npm@11 ci` (npm 10.9 échoue sur ce projet) puis `ng build --configuration production`
2. `backend-build` : `npm ci`, `nest build`, `npm prune --omit=dev`
3. `runtime` : `node:22-bookworm-slim` (glibc → binaires précompilés `better-sqlite3` disponibles, pas de toolchain
   de compilation nécessaire) ; copie de `dist/`, `node_modules/` de prod et du build Angular dans `/app/public`

## Impacts côté backend

- `STATIC_DIR` (optionnel) dans la config typée et le schéma Joi. Vide/absent → API seule (comportement inchangé en
  dev, où `ng serve` proxifie `/api`).
- `StaticModule` : enregistre `ServeStaticModule` uniquement si `STATIC_DIR` est défini ; `/api/v1/*` est exclu du
  fallback `index.html` (un `GET /api/v1/inconnu` renvoie toujours un 404 JSON).
- `buildHelmetOptions` (`backend/src/config/helmet-options.ts`) : en mode « frontend servi », la CSP autorise Google
  Fonts (Archivo), les avatars GitLab (`img-src https: http:`) et désactive `upgrade-insecure-requests` pour que
  l'application fonctionne en http simple (LAN, Docker). En mode API seule, Helmet garde ses défauts.
