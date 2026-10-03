FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ARG VITE_MAPBOX_TOKEN=
ARG VITE_MAPBOX_STYLE=mapbox://styles/mapbox/dark-v11
ARG VITE_ALLOW_HTTP_SOURCES=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
  VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
  VITE_MAPBOX_STYLE=$VITE_MAPBOX_STYLE \
  VITE_ALLOW_HTTP_SOURCES=$VITE_ALLOW_HTTP_SOURCES
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @atlas/contracts --workspace @atlas/web --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build --workspace @atlas/contracts && npm run build --workspace @atlas/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=4s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1