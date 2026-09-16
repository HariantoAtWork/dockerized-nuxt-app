# Configuration

## Docker / orchestrator (`.env` and image `ENV`)

Compose loads `.env` for host `${…}` substitution **and** as an `env_file` so runtime settings reach the container. See `.env.example`.

| Variable | Default | Notes |
|----------|---------|--------|
| `GITHUB_REPO_URL` | — | Required; may embed a token |
| `DOCKER_HUB_IMAGE` | — | Image pulled by compose |
| `NUXT_HOST_PORT` | `3300` | Host port → container `3000` (compose only) |
| `ADMIN_HOST_PORT` | `9090` | Host port → container `9090` (compose only) |
| `GIT_BRANCH` | `main` | Initial branch if no persisted file |
| `ADMIN_TOKEN` | unset | Protects mutating admin APIs |
| `VERBOSE_LOGGING` | `true` | |
| `WATCH_INTERVAL_MS` | `60000` | Git poll interval |
| `ORCHESTRATOR_STATE_DIR` | `/var/lib/orchestrator` | CI state directory |
| `GIT_BRANCH_FILE` | `$ORCHESTRATOR_STATE_DIR/git_branch` | Persisted active branch |
| `CURRENT_COMMIT_FILE` | `$ORCHESTRATOR_STATE_DIR/current_commit` | |
| `LAST_COMMIT_FILE` | `$ORCHESTRATOR_STATE_DIR/last_commit` | |
| `BUILD_COMPLETE_FLAG` | `$ORCHESTRATOR_STATE_DIR/build-complete.flag` | |
| `PINNED_COMMIT_FILE` | `$ORCHESTRATOR_STATE_DIR/pinned_commit` | |
| `APP_ROOT` | `/app` | Serve-related root (defaults match `APP_OUTPUT`) |
| `GITHUB_REPO` | `/git` | Cloned Nuxt repository |
| `APP_OUTPUT` | `/app` | Served Nitro output (nodemon watch + `server/index.mjs`) |
| `APP_BUILD` | `/app` | Path checked for a complete served build |
| `ADMIN_BIND` | `0.0.0.0` | |
| `ADMIN_PORT` | `9090` | In-container admin listen port |

## Application (`.env.app`)

Passed into the container for the **cloned Nuxt app** (and shared process env). The orchestrator does not read these variables — put only what your Nuxt app needs. Keep Nuxt data under `/data`, not under orchestrator state. See `.env.app.example`.

## Cloned app scripts

`package.json` must define **`scripts.ci` and/or `scripts.build`**. Prefer `ci` when both exist. Use `bun run …`, not `bun build` (Bundler).
