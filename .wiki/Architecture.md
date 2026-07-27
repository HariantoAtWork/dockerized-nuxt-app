# Architecture

## What runs in the container

| Layer | Path / tool | Role |
|-------|-------------|------|
| Base | `node:22-alpine` | OS + Node (for global `nodemon`) |
| Bun | Official `curl \| bash` install + `bun upgrade --canary` | Orchestrator runtime + cloned-app `bun install` / `bun run ci\|build` |
| Orchestrator | `/opt/orchestrator` (image) | Git sync, build pipeline, admin HTTP, process supervision |
| Nodemon | Global npm package | Watches `.output`, runs `.output/server/index.mjs` |
| Admin UI | `/opt/orchestrator/static` | Vue dashboard (built in Docker multi-stage) |

## Process flow

1. **Git sync** — clone or update `origin/<branch>` (initial `GIT_BRANCH` / persisted `git_branch`), checkout `-B`, `git clean -fd`.
2. **Build** — `bun install`, then `bun run ci` if present, else `bun run build`.
3. **Gate** — wait for `build-complete.flag` (under orchestrator state) and `/app/.output/server/index.mjs`.
4. **Serve** — start nodemon with `cwd=/app`, watching `APP_OUTPUT`, entry `.output/server/index.mjs`.
5. **Watch** — poll the **active** branch every `WATCH_INTERVAL_MS`; on new commits, rebuild and restart nodemon.

Admin actions (rebuild, restart, branch switch) take the same mutex as the watcher so only one deploy runs at a time.

## Important CLI distinction

- `bun run build` / `bun run ci` — package.json scripts (Nuxt/Nitro) — **used by this orchestrator**
- `bun build` — Bun’s native bundler — **not** used for Nuxt production builds here
