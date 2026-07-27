# Admin API and dashboard

Dashboard: **http://127.0.0.1:9091/** (compose maps `127.0.0.1:9091:9090`).

When `ADMIN_TOKEN` is set, mutating routes need `Authorization: Bearer <token>` or `?token=` on the URL.

## Status UI

The dashboard shows:

- **Build entry** — whether `/app/.output/server/index.mjs` exists (`serverEntryExists` / `serverEntryPath`)
- **Nodemon** — whether the supervised process is running (`appRunning` / `appPid`)
- Combined readiness label (live / waiting / stopped / degraded)
- **Deploy branch** — list remote branches, switch + rebuild live, refresh list

Full JSON status remains under a collapsible panel; logs poll every 10s.

## HTTP API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/status` | No | Orchestrator snapshot |
| `GET` | `/api/logs?n=120` | No | Recent log lines |
| `GET` | `/api/branches` | No | `{ current, branches }` (fetches remotes) |
| `POST` | `/api/branch` | Yes* | Body `{ "branch": "feature-x" }` — checkout, rebuild, restart |
| `POST` | `/api/rebuild` | Yes* | Force rebuild + restart |
| `POST` | `/api/restart-app` | Yes* | Restart nodemon only |

\*Required only when `ADMIN_TOKEN` is set.

### Example

```bash
curl -s http://127.0.0.1:9091/api/status
curl -s http://127.0.0.1:9091/api/branches
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"branch":"feature-x"}' \
  http://127.0.0.1:9091/api/branch
```

Branch switches persist to `/var/lib/orchestrator/git_branch` and the commit watcher follows the new branch.
