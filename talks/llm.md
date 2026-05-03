# Building a Self-Updating Nuxt.js Application with Docker and a Bun Orchestrator

This repository ships a Docker image whose purpose is to clone or update a Git-hosted Nuxt application into `/app`, build it with Bun, run the Nitro output via nodemon, poll Git for new commits, and expose a small HTTP admin API for status and actions.

## Goals

- Automated clone and pull from `GITHUB_REPO_URL` (token embedded as Git HTTPS credentials).
- Rebuild when `origin/<GIT_BRANCH>` moves or when `.output/server/index.mjs` is missing.
- Persist `/app` (and optional caches) on Docker volumes.
- Healthcheck against Nuxt on port 3000 inside the container (Compose maps host `3300:3000`).
- Replace Supervisor + shell scripts with one Bun/TypeScript process (`/opt/orchestrator`).

## Runtime layout

- `/opt/orchestrator` — orchestrator package (`package.json`, `src/*.ts`), started with `bun run start`.
- `/app` — bind-mounted volume containing the cloned repo and `.output/`.

## Orchestrator phases

1. Git sync: clone, fetch, compare `HEAD` to `origin/<GIT_BRANCH>`, force-reset when needed (handles force-push), recover `.git` into an existing directory without metadata when necessary.
2. Build: `bun install`, then `bun run ci` if `scripts.ci` exists, otherwise `bun run build` if `scripts.build` exists (at least one must exist).
3. Serve: wait for `/app/.build-complete.flag` and `.output/server/index.mjs`, then run nodemon with `--watch` on `.output`, cwd `/app`, script `.output/server/index.mjs`.
4. Watch: every `WATCH_INTERVAL_MS` (default 60s), fetch and compare commits; if remote advanced, run another build cycle and restart nodemon.

## Admin dashboard

- HTTP server on `ADMIN_BIND`:`ADMIN_PORT` (defaults `0.0.0.0:9090`). Compose can publish `127.0.0.1:9091:9090` on the host.
- **UI**: Vue 3 + Vite app in `admin-ui/`; production build copied to `static/` (or baked into the image at `/opt/orchestrator/static`). Bun serves `index.html`, hashed JS/CSS assets, and SPA fallback for client routes.
- JSON routes: `GET /api/status`, `GET /api/logs`, `POST /api/rebuild`, `POST /api/restart-app`.
- If `ADMIN_TOKEN` is set, POST endpoints require `Authorization: Bearer <token>` or `?token=` on the dashboard URL.

## Observability

- Primary logs go to container stdout (`docker compose logs -f`).
- Ring buffer backs `/api/logs` for recent orchestrator lines.

## Operational notes

- Do not log raw `GITHUB_REPO_URL`; orchestrator redacts userinfo in logs.
- Set `GIT_BRANCH` when the default branch is not `main`.
- Use `ADMIN_TOKEN` whenever the admin port is reachable beyond localhost.
