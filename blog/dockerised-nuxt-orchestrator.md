---
title: Dockerising Nuxt with a Bun orchestrator
slug: dockerised-nuxt-orchestrator
date: "2026-07-30T11:17:10.000Z"
updated: "2026-07-30T11:17:10.000Z"
status: published
type: post
featured: false
visibility: public
tags:
  - Docker
  - Nuxt
  - Bun
  - DevOps
  - Orchestration
  - Self-hosting
authors:
  - Harianto van Insulinde
---

Running a Nuxt app in Docker sounds simple until you want continuous deploys, branch switches, rebuilds, and a live process without bolting Supervisor onto the image. This project is my answer: a single container that clones your repo, builds with Bun, keeps the Nitro server warm with nodemon, and exposes a small admin dashboard for the day-to-day ops.

## The problem

I wanted a Nuxt (and Nitro) deployment that could:

- pull from GitHub on a schedule
- rebuild when commits move
- switch branches without rebuilding the Docker image
- keep app data, clone, and CI state on separate volumes
- give me a clear signal when the build is ready and the server is actually running

Most “Nuxt in Docker” recipes stop at `bun run build` and `node .output/server/index.mjs`. That works for a static deploy. It falls short when the container itself is the CI runner and the process supervisor.

## What this stack does

The image is based on `node:22-alpine`, installs Bun via the official script (then upgrades to canary), and ships a TypeScript orchestrator plus a Vue admin UI.

Rough flow inside the container:

1. **Git sync** — clone or update `origin/<branch>`, checkout, clean
2. **Build** — `bun install`, then `bun run ci` if present, else `bun run build`
3. **Gate** — wait for a build-complete flag and `.output/server/index.mjs`
4. **Serve** — nodemon watches `.output` and runs the Nitro entry
5. **Watch** — poll the active branch; on new commits, rebuild and restart

Admin actions (rebuild, restart, branch switch) share the same mutex as the watcher, so only one deploy runs at a time.

One CLI detail that bites people: the orchestrator runs **`bun run build` / `bun run ci`** (your `package.json` scripts). It does **not** call Bun’s native `bun build` bundler for Nuxt production builds.

## Volumes that stay out of each other’s way

| Path | Role |
|------|------|
| `/opt/orchestrator` | Orchestrator + static admin UI (in the image) |
| `/app` | Cloned repo + `.output` |
| `/data` | Nuxt application data |
| `/var/lib/orchestrator` | CI state: branch, commits, build flag |

That split keeps a `git clean` from wiping orchestrator state, and keeps app uploads out of the clone tree.

## Admin dashboard

The dashboard listens on the host (default `127.0.0.1:9091`) and talks to a small HTTP API:

- status signals — build entry present, nodemon running, current branch and commit
- logs
- branch list and on-the-fly switch (rebuild → live)
- rebuild / restart
- a git graph side panel so you can see history, pin a commit, and switch/rebuild from a specific revision

Optional `ADMIN_TOKEN` protects the mutating endpoints. For local UI work you can run the Vue admin with Bun and proxy `/api` to the orchestrator.

## Quick start shape

You point the container at a repo (token in the URL if private), create cache volumes for Bun/pnpm, and bring Compose up. The Nuxt app is expected on port 3000 inside the container (mapped, e.g. to 3300). Production Compose can pull a pre-built image from your registry instead of building locally.

The cloned app must define `scripts.ci` and/or `scripts.build`. The orchestrator always runs `bun install` first.

## Why Bun + nodemon

Bun is the orchestrator runtime and the install/build tool for the cloned app — fast installs, one toolchain. Nodemon stays as the server supervisor (watching `.output`) rather than leaning on `bun --watch` for the production Nitro entry. That gate-before-serve behaviour matters: you do not want the process manager to thrash while the build is still writing `index.mjs`.

## Who this is for

If you self-host Nuxt and want the container to own Git sync, CI, and process life-cycle — with a dashboard for branch deploys and a git graph for intentional rollbacks — this pattern fits. If you already have external CI that only drops an artefact into a dumb Node image, you probably do not need this orchestrator.

The repo, wiki, and Compose files live with the project; start from the README for env vars and volume layout, then the wiki for architecture and the admin API.

Ship the image, point it at your Nuxt repo, and let the orchestrator do the boring part.
