# --- Vue admin UI (Vite build → copied to /opt/orchestrator/static) ---
FROM node:22-alpine AS admin-ui-build
RUN apk add --no-cache curl bash unzip \
  && curl -fsSL https://bun.com/install | bash \
  && ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
  && bun upgrade --canary
WORKDIR /build
COPY admin-ui ./admin-ui
WORKDIR /build/admin-ui
RUN bun install --frozen-lockfile && bun run build

# --- Runtime image ---
FROM node:22-alpine

# Environment variables #1
ENV CI=1
ENV BETTER_AUTH_TELEMETRY=0
ENV BETTER_AUTH_TELEMETRY_DEBUG=0

# Environment variables #2 (runtime Git/app paths — cloned repo and flags live under APP_ROOT)
ENV APP_ROOT="/app"
ENV GITHUB_REPO="/app"
ENV APP_BUILD="${GITHUB_REPO}/.output"
ENV APP_OUTPUT="${APP_ROOT}/.output"
ENV CURRENT_COMMIT_FILE="${APP_ROOT}/.current_commit"
ENV LAST_COMMIT_FILE="${APP_ROOT}/.last_commit"
ENV BUILD_COMPLETE_FLAG="${APP_ROOT}/.build-complete.flag"
ENV PROJECT_BUILD_SCRIPT="${GITHUB_REPO}/scripts/build.sh"

# Admin HTTP (orchestrator dashboard). Use ADMIN_TOKEN when exposing a port.
ENV ADMIN_BIND="0.0.0.0"
ENV ADMIN_PORT="9090"

# git/rsync for clone; wget for healthcheck; curl/bash/unzip for official Bun install
# nodemon watches .output and runs .output/server/index.mjs
RUN apk add --no-cache git wget rsync curl bash unzip \
  && curl -fsSL https://bun.com/install | bash \
  && ln -sf /root/.bun/bin/bun /usr/local/bin/bun \
  && bun upgrade --canary \
  && npm install -g nodemon

WORKDIR /opt/orchestrator

COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY --from=admin-ui-build /build/admin-ui/dist ./static

RUN bun install --frozen-lockfile

EXPOSE 3000
EXPOSE 9090

CMD ["bun", "run", "start"]
