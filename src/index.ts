import { readFileSync } from "node:fs";
import { createAppRunner } from "./app-runner.ts";
import { startAdminServer } from "./admin-server.ts";
import { runInstallAndBuild } from "./build-pipeline.ts";
import { loadConfig } from "./config.ts";
import { isDirectory, isFile } from "./fs-utils.ts";
import { assertValidGitBranch } from "./git-branch.ts";
import { commitSubject } from "./git-commit.ts";
import { assertValidGitCommit } from "./git-commit-ref.ts";
import { getGitGraph } from "./git-graph.ts";
import { toRepoWebUrl } from "./git-web-url.ts";
import { createRingLog } from "./logger.ts";
import { Mutex } from "./mutex.ts";
import { redactGitUrl } from "./redact.ts";
import {
  checkoutPinnedCommit,
  clearBuildFlag,
  clearPinnedCommit,
  listRemoteBranches,
  persistGitBranch,
  persistPinnedCommit,
  readPinnedCommit,
  syncGitRepository,
  touchBuildFlag,
} from "./repo-sync.ts";
import type { OrchestratorPhase, OrchestratorSnapshot } from "./types.ts";
import { startCommitWatcher } from "./watcher.ts";

function readCommitFile(path: string): string | null {
  try {
    const t = readFileSync(path, "utf8").trim();
    return t || null;
  } catch {
    return null;
  }
}

async function waitForRunnable(cfg: ReturnType<typeof loadConfig>): Promise<void> {
  while (!(await Bun.file(cfg.buildCompleteFlag).exists())) {
    await Bun.sleep(2000);
  }
  const serverMjs = `${cfg.appOutput}/server/index.mjs`;
  while (!isDirectory(cfg.appOutput) || !isFile(serverMjs)) {
    await Bun.sleep(2000);
  }
}

const STARTUP_RETRY_MS = 5_000;

async function main() {
  const cfg = loadConfig();
  if (!cfg.githubRepoUrl) {
    console.error(
      "GITHUB_REPO_URL is required (e.g. https://token@github.com/org/repo.git)",
    );
    process.exit(1);
  }

  const log = createRingLog(cfg.verboseLogging);
  log.info(
    `Orchestrator starting; repo URL: ${redactGitUrl(cfg.githubRepoUrl)}; branch: ${cfg.gitBranch}`,
  );

  const mutex = new Mutex();
  const app = createAppRunner(cfg, log);

  let phase: OrchestratorPhase = "idle";
  let lastBuildAt: string | null = null;
  let lastError: string | null = null;
  let stopWatcher: (() => void) | null = null;

  async function executeBuildPhase(opts: {
    forceBuild: boolean;
  }): Promise<{ built: boolean }> {
    lastError = null;
    await clearBuildFlag(cfg);
    const sync = await syncGitRepository(cfg, log);
    const shouldBuild = opts.forceBuild || sync.buildNeeded;

    if (!shouldBuild) {
      await touchBuildFlag(cfg);
      return { built: false };
    }

    phase = "building";
    await runInstallAndBuild(cfg, cfg.githubRepo, log);
    await touchBuildFlag(cfg);
    lastBuildAt = new Date().toISOString();
    return { built: true };
  }

  async function rebuildAndRestart(label: string): Promise<void> {
    log.info(label);
    phase = "building";
    try {
      await executeBuildPhase({ forceBuild: true });
      await waitForRunnable(cfg);
      phase = "running";
      await app.stop();
      await app.start();
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      log.error(lastError);
      phase = app.isRunning() ? "running" : "idle";
      throw e;
    }
  }

  async function getSnapshot(): Promise<OrchestratorSnapshot> {
    const serverEntryPath = `${cfg.appOutput}/server/index.mjs`;
    const currentCommit = readCommitFile(cfg.currentCommitFile);
    const remoteCommit = readCommitFile(cfg.lastCommitFile);
    const [currentCommitMessage, remoteCommitMessage, pinnedCommit] =
      await Promise.all([
        commitSubject(cfg.githubRepo, currentCommit),
        commitSubject(cfg.githubRepo, remoteCommit),
        readPinnedCommit(cfg),
      ]);
    return {
      phase,
      gitBranch: cfg.gitBranch,
      repoRoot: cfg.githubRepo,
      repoWebUrl: toRepoWebUrl(cfg.githubRepoUrl),
      pinnedCommit,
      currentCommit,
      currentCommitMessage,
      remoteCommit,
      remoteCommitMessage,
      appRunning: app.isRunning(),
      appPid: app.getPid(),
      serverEntryExists: isFile(serverEntryPath),
      serverEntryPath,
      lastBuildAt,
      lastError,
      watchIntervalMs: cfg.watchIntervalMs,
    };
  }

  const admin = startAdminServer(cfg, {
    getSnapshot,
    getGitGraph: async (n) => getGitGraph(cfg.githubRepo, n),
    getLogs: (n) => log.tail(n),
    listBranches: async () => ({
      current: cfg.gitBranch,
      branches: await listRemoteBranches(cfg),
    }),
    switchBranch: async (branch) => {
      const safe = assertValidGitBranch(branch);
      await mutex.runExclusive(async () => {
        const wasPinned = await readPinnedCommit(cfg);
        await clearPinnedCommit(cfg);
        if (wasPinned) {
          log.info(
            `Admin: clearing pin ${wasPinned.slice(0, 7)} before branch deploy`,
          );
        }
        if (safe === cfg.gitBranch) {
          log.info(
            wasPinned
              ? `Admin: unpinning and rebuilding tip of ${safe}`
              : `Admin: already on branch ${safe}; forcing rebuild`,
          );
        } else {
          log.info(`Admin: switching branch ${cfg.gitBranch} → ${safe}`);
          phase = "syncing";
          await persistGitBranch(cfg, safe);
        }
        await rebuildAndRestart(`Admin: live deploy for branch ${safe}`);
      });
    },
    switchCommit: async (commit) => {
      const safe = assertValidGitCommit(commit);
      await mutex.runExclusive(async () => {
        phase = "syncing";
        const resolved = await checkoutPinnedCommit(cfg, log, safe);
        await persistPinnedCommit(cfg, resolved);
        await rebuildAndRestart(
          `Admin: live deploy for commit ${resolved.slice(0, 7)}`,
        );
      });
    },
    unpinCommit: async () => {
      await mutex.runExclusive(async () => {
        const pinned = await readPinnedCommit(cfg);
        await clearPinnedCommit(cfg);
        phase = "syncing";
        log.info(
          pinned
            ? `Admin: unpinning ${pinned.slice(0, 7)}; returning to origin/${cfg.gitBranch}`
            : `Admin: no pin set; syncing origin/${cfg.gitBranch}`,
        );
        await rebuildAndRestart(
          `Admin: unpinned; live deploy for branch ${cfg.gitBranch}`,
        );
      });
    },
    triggerRebuild: async () => {
      await mutex.runExclusive(async () => {
        await rebuildAndRestart("Admin: forced rebuild");
      });
    },
    restartApp: async () => {
      await mutex.runExclusive(async () => {
        log.info("Admin: restart app");
        phase = "running";
        await app.stop();
        await waitForRunnable(cfg);
        await app.start();
      });
    },
  });

  log.info(
    `Admin dashboard at http://${cfg.adminBind}:${cfg.adminPort}/ (container pid ${process.pid})`,
  );

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  async function shutdown() {
    log.info("Shutting down…");
    stopWatcher?.();
    stopWatcher = null;
    admin.stop();
    await app.stop();
    process.exit(0);
  }

  async function bootOnce(): Promise<void> {
    const serverEntryPath = `${cfg.appOutput}/server/index.mjs`;
    // Serve a previous build immediately while sync/build runs (persistent /app volume).
    if (isFile(serverEntryPath) && !app.isRunning()) {
      log.info(
        "Server entry already present; starting app while sync/build runs...",
      );
      phase = "running";
      await app.start();
    } else if (!app.isRunning()) {
      phase = "syncing";
    }

    const { built } = await executeBuildPhase({ forceBuild: false });
    await waitForRunnable(cfg);
    phase = "running";
    // Restart after a real build so nodemon picks up a complete output tree.
    // If we already started early and nothing was rebuilt, leave the process alone.
    if (built || !app.isRunning()) {
      await app.stop();
      await app.start();
    }
  }

  // Keep the orchestrator (and admin UI) alive: retry sync/build until ready.
  for (;;) {
    try {
      await mutex.runExclusive(async () => {
        await bootOnce();
      });
      lastError = null;
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      log.error(
        `Not ready yet (${lastError}); retrying in ${STARTUP_RETRY_MS / 1000}s…`,
      );
      phase = app.isRunning() ? "running" : "idle";
      await Bun.sleep(STARTUP_RETRY_MS);
    }
  }

  stopWatcher = startCommitWatcher(cfg, log, async () => {
    await mutex.runExclusive(async () => {
      phase = "building";
      try {
        const result = await executeBuildPhase({ forceBuild: false });
        await waitForRunnable(cfg);
        phase = "running";
        if (result.built || !app.isRunning()) {
          await app.stop();
          await app.start();
        }
        lastError = null;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        log.error(lastError);
        phase = app.isRunning() ? "running" : "idle";
      }
    });
  });
}

void main();
