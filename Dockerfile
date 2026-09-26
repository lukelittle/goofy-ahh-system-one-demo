# The website (Next.js), as a small non-root image.
#
# Stage 1 installs dependencies and builds; the final stage carries only the
# standalone server Next emits (see next.config.ts), so node_modules, the
# TypeScript sources and the build tooling never reach the runtime image.
# No secrets are baked in: CIRCUIT_API_KEY is injected at runtime.

FROM node:22.22.2-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json next.config.ts postcss.config.mjs ./
COPY src ./src
RUN npm run build

FROM node:22.22.2-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# uid/gid 1000 is the image's unprivileged "node" user; numeric so the runtime can verify it
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/classify').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
