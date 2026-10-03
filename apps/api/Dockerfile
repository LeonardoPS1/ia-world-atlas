FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @atlas/contracts --workspace @atlas/api --include-workspace-root

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build --workspace @atlas/contracts \
  && npm run build --workspace @atlas/api \
  && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S atlas && adduser -S atlas -G atlas
COPY --from=build --chown=atlas:atlas /app/node_modules ./node_modules
COPY --from=build --chown=atlas:atlas /app/package.json ./package.json
COPY --from=build --chown=atlas:atlas /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=atlas:atlas /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=atlas:atlas /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=atlas:atlas /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=atlas:atlas /app/apps/api/migrations ./apps/api/migrations
USER atlas
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]