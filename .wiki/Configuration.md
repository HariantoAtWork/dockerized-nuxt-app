# Configuration

## Docker / orchestrator (`.env` and image `ENV`)

| Variable | Default | Notes |
|----------|---------|--------|
| `GITHUB_REPO_URL` | — | Required; may embed a token |
| `GIT_BRANCH` | `main` | Initial branch if no persisted file |
| `ORCHESTRATOR_STATE_DIR` | `/var/lib/orchestrator` | CI state directory |
| `GIT_BRANCH_FILE` | `$ORCHESTRATOR_STATE_DIR/git_branch` | Persisted active branch |
| `CURRENT_COMMIT_FILE` | `$ORCHESTRATOR_STATE_DIR/current_commit` | |
| `LAST_COMMIT_FILE` | `$ORCHESTRATOR_STATE_DIR/last_commit` | |
| `BUILD_COMPLETE_FLAG` | `$ORCHESTRATOR_STATE_DIR/build-complete.flag` | |
| `APP_ROOT` | `/app` | Clone + output root / nodemon `cwd` |
| `GITHUB_REPO` | `/app` | Same as app root by default |
| `APP_OUTPUT` | `$APP_ROOT/.output` | Nodemon watch dir |
| `ADMIN_BIND` | `0.0.0.0` | |
| `ADMIN_PORT` | `9090` | Host often `9091` |
| `ADMIN_TOKEN` | unset | Protects mutating admin APIs |
| `WATCH_INTERVAL_MS` | `60000` | Git poll interval |
| `VERBOSE_LOGGING` | `true` | |
| `DOCKER_HUB_IMAGE` | — | Production compose image name |

## Application (`.env.app`)

Passed into the container for the **cloned Nuxt app** (and shared process env). Keep Nuxt data under `/data`, not under orchestrator state.

## Cloned app scripts

`package.json` must define **`scripts.ci` and/or `scripts.build`**. Prefer `ci` when both exist. Use `bun run …`, not `bun build` (Bundler).
