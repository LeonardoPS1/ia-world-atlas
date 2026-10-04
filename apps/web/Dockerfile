# syntax = docker/dockerfile:1.7
# check=skip=SecretsUsedInArgOrEnv
# VITE_MAPBOX_TOKEN is a public Mapbox token (pk.*) that is embedded in the
# client bundle by design; it is not a server-side secret. It must be a build
# ARG so Docker Compose / Dokploy can inject it at image build time.
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ARG VITE_MAPBOX_TOKEN=
ARG VITE_MAPBOX_STYLE=mapbox://styles/mapbox/dark-v11
ARG VITE_ALLOW_HTTP_SOURCES=false

COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @atlas/contracts --workspace @atlas/web --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

# ARG values are exported into the RUN environment, so Vite reads them.
RUN npm run build --workspace @atlas/contracts && npm run build --workspace @atlas/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=4s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1