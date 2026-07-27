# Volumes and paths

Keep these three concerns separate:

| Container path | Host mount (compose) | Purpose |
|----------------|----------------------|---------|
| `/app` | `./data/app` | Cloned Nuxt repo + `.output` |
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

These live **outside** the git work tree, so `git clean -fd` in `/app` cannot delete them. The volume survives container restarts.

## Runtime layout

```
/opt/orchestrator/          # Image: orchestrator package + static admin UI
/app/                       # Volume: clone
├── .output/
│   └── server/index.mjs    # Nodemon entry (must exist before start)
├── package.json
└── …
/data/                      # Volume: Nuxt application data only
/var/lib/orchestrator/      # Volume: CI state (see table above)
```
