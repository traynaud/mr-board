# syntax=docker/dockerfile:1
# MR Board — image unique : API NestJS + frontend Angular servi par le même process.

# ---------- Étape 1 : build du frontend ----------
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
# npm 10.9 échoue sur ce projet (bug Arborist avec Vitest 4) : on passe par npm 11.
RUN npx --yes npm@11 ci --no-audit --no-fund
COPY frontend/ ./
RUN npx ng build --configuration production

# ---------- Étape 2 : build du backend ----------
FROM node:22-bookworm-slim AS backend-build
WORKDIR /src/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
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
