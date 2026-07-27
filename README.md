# Nuxt.js Docker Application

A containerised Nuxt.js application with automated Git-based deployment, continuous monitoring, and build management using Docker Compose and a **Bun/TypeScript orchestrator** (no Supervisor).

Deeper operational docs live in [`.wiki/`](.wiki/Home.md).

## Features

- **Automated Git deployment** — clone/update from GitHub, including on-the-fly **branch switch** from the admin UI
- **Smart builds** — rebuild when commits move (or output is missing): `bun install` + `bun run ci` / `bun run build`
- **Process supervision** — nodemon watches `.output` and runs `.output/server/index.mjs` (gated until the entry exists)
- **Admin dashboard** — runtime signals (build entry + nodemon), branch deploy, logs, rebuild/restart
- **Separated volumes** — `/app` clone, `/data` Nuxt app data, `/var/lib/orchestrator` CI state
- **Health checks** — compose healthcheck on port 3000

## Prerequisites

- Docker and Docker Compose
- Git access to your Nuxt.js repository
- GitHub Personal Access Token (for private repositories)

## Quick start

### 1. Environment

Create a `.env` file:

```bash
GITHUB_REPO_URL=https://YOUR_TOKEN@github.com/username/repository.git
DOCKER_HUB_IMAGE=your-registry/nuxt-app:latest
VERBOSE_LOGGING=true
# GIT_BRANCH=main
# ADMIN_TOKEN=
```

Create a `.env.app` file for the cloned Nuxt app:

```bash
NODE_ENV=production
# Nuxt-specific vars; keep app data under /data
```

### 2. Cache volumes

```bash
docker volume create bun-cache
docker volume create pnpm-store
```

### 3. Start

```bash
# Development (builds local Dockerfile)
docker compose up -d

# Production (pulls DOCKER_HUB_IMAGE)
docker compose -f docker-compose.production.yml up -d
```

- App: `http://localhost:3300`
- Admin: `http://127.0.0.1:9091/`

## Architecture (summary)

| Path | Role |
|------|------|
| `/opt/orchestrator` | Orchestrator + static admin UI (image) |
| `/app` | Cloned repo + `.output` (`./data/app`) |
| `/data` | Reserved for Nuxt app data (`./data/data`) |
| `/var/lib/orchestrator` | CI state: branch, commits, build flag (`./data/orchestrator`) |

**Flow:** git sync → `bun install` + `ci`/`build` → wait for build flag + `index.mjs` → nodemon → poll active branch.

Bun is installed via the official install script and upgraded to **canary** in the image. Nodemon remains the server supervisor (not `bun --watch`).

See [.wiki/Architecture.md](.wiki/Architecture.md) and [.wiki/Volumes-and-paths.md](.wiki/Volumes-and-paths.md).

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_REPO_URL` | Repo URL (with token if private) | Yes |
| `DOCKER_HUB_IMAGE` | Image name for production compose | Production |
| `GIT_BRANCH` | Initial branch if none persisted | No (`main`) |
| `ORCHESTRATOR_STATE_DIR` | CI state directory | No (`/var/lib/orchestrator`) |
| `ADMIN_TOKEN` | Protects rebuild / restart / branch switch | No |
| `WATCH_INTERVAL_MS` | Git poll interval | No (`60000`) |
| `VERBOSE_LOGGING` | Verbose orchestrator logs | No (`true`) |

Full list: [.wiki/Configuration.md](.wiki/Configuration.md).

### Volumes

- `./data/app:/app` — clone + build output
- `./data/data:/data` — Nuxt application data only
- `./data/orchestrator:/var/lib/orchestrator` — orchestrator CI state
- `bun-cache`, `pnpm-store` — package caches

## Admin UI & API

- Status signals: build entry present / nodemon running
- Branch panel: refresh remotes, switch branch → rebuild → live
- APIs: `/api/status`, `/api/logs`, `/api/branches`, `POST /api/branch`, `POST /api/rebuild`, `POST /api/restart-app`

```bash
curl -s http://127.0.0.1:9091/api/status
curl -s http://127.0.0.1:9091/api/branches
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"branch":"feature-x"}' \
  http://127.0.0.1:9091/api/branch
```

Details: [.wiki/Admin-API.md](.wiki/Admin-API.md).

### Local admin UI development

```bash
bun run build:admin          # → static/ (also built in Docker)
cd admin-ui && bun run dev   # proxy /api → :9090
bun run start                # orchestrator in another terminal
```

## Deployment

```bash
docker compose up -d
docker compose logs -f nuxt-app

docker build -t your-registry/nuxt-app:latest .
docker push your-registry/nuxt-app:latest
docker compose -f docker-compose.production.yml up -d
```

## Troubleshooting

1. **Repo access** — ensure `GITHUB_REPO_URL` includes a token when needed.
2. **Build failures** — `docker compose logs -f nuxt-app`; require `scripts.ci` and/or `scripts.build` (use `bun run …`, not `bun build`).
3. **App not starting**
   ```bash
   docker compose exec nuxt-app ls -la /var/lib/orchestrator/build-complete.flag
   docker compose exec nuxt-app ls -la /app/.output/server/index.mjs
   ```
4. **Wrong branch** — check `/api/status` → `gitBranch`, or `/var/lib/orchestrator/git_branch`; switch from the dashboard.

```bash
docker compose exec nuxt-app sh
cd /app && git status
```

## Build expectations

The cloned app must define **`scripts.ci` and/or `scripts.build`**. The orchestrator runs `bun install` first.

## License

MIT — see the LICENSE file for details.

---

**Last updated**: 2026-07-27T02:36:27+0200
