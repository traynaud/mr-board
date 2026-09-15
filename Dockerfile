# syntax=docker/dockerfile:1
# MR Board — image unique : API NestJS + frontend Angular servi par le même process.

# ---------- Étape 1 : build du frontend ----------
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
# npm 10.9 échoue sur ce projet (bug Arborist avec Vitest 4) : on passe par une version récente.
RUN npm install -g npm@12 && npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npx ng build --configuration production

# ---------- Étape 2 : build du backend ----------
FROM node:22-bookworm-slim AS backend-build
WORKDIR /src/backend
# better-sqlite3 may fall back to a local node-gyp build when its prebuilt
# binary is unavailable; the slim image does not include these build tools.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
# npm embarqué dans l'image de base est en retard : on l'upgrade avant d'installer.
# npm 12 bloque par défaut les scripts d'installation natifs non approuvés ; better-sqlite3
# est explicitement approuvé dans package.json ("allowScripts") pour que son binding compile.
RUN npm install -g npm@12 && npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build \
 && npm prune --omit=dev

# ---------- Étape 3 : image d'exécution ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/mr-board.sqlite \
    STATIC_DIR=/app/public \
    CORS_ORIGIN=http://localhost:3000
WORKDIR /app
COPY --from=backend-build /src/backend/node_modules ./node_modules
COPY --from=backend-build /src/backend/dist ./dist
COPY --from=backend-build /src/backend/package.json ./package.json
COPY --from=frontend-build /src/frontend/dist/frontend/browser ./public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
