# Volumes and paths

Keep these concerns separate:

| Container path | Host mount (compose) | Purpose |
|----------------|----------------------|---------|
| `/git` | `./data/git` | Cloned Nuxt repo (source + `node_modules` + default `.output`) |
| `/app` | `./data/app` | Served Nitro output (published from `/git/.output` after build) |
| `/data` | `./data/data` | **Reserved for the Nuxt app** (e.g. `NUXT_APPLICATION_DATA_ROOT`) |
| `/var/lib/orchestrator` | `./data/orchestrator` | Docker CI / orchestrator state |

Also mounted: `bun-cache`, `pnpm-store` for package caches.


## Orchestrator state (`ORCHESTRATOR_STATE_DIR`)

Default: `/var/lib/orchestrator`

| File | Meaning |
|------|---------|
| `git_branch` | Active branch (admin UI can change this) |
| `current_commit` | Last recorded `HEAD` |
| `last_commit` | Last recorded `origin/<branch>` tip |
| `build-complete.flag` | Safe to run the server after CI |

These live **outside** the git work tree, so `git clean -fd` in `/git` cannot delete them. The volume survives container restarts.


## Runtime layout

```
/opt/orchestrator/          # Image: orchestrator package + static admin UI
/git/                       # Volume: clone
├── .git/
├── package.json
├── .output/                # Nuxt default build (then published → /app)
└── …
/app/                       # Volume: served build
├── server/index.mjs        # Nodemon entry
└── public/
/data/                      # Volume: Nuxt application data only
/var/lib/orchestrator/      # Volume: CI state (see table above)
```
