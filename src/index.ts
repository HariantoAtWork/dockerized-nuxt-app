import { readFileSync } from "node:fs";
import { createAppRunner } from "./app-runner.ts";
import { startAdminServer } from "./admin-server.ts";
import { runInstallAndBuild } from "./build-pipeline.ts";
import { loadConfig } from "./config.ts";
import { isDirectory, isFile } from "./fs-utils.ts";
import { createRingLog } from "./logger.ts";
import { Mutex } from "./mutex.ts";
import { redactGitUrl } from "./redact.ts";
import {
  clearBuildFlag,
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

async function main() {
  const cfg = loadConfig();
  if (!cfg.githubRepoUrl) {
    console.error(
      "GITHUB_REPO_URL is required (e.g. https://token@github.com/org/repo.git)",
    );
    process.exit(1);
  }

  const log = createRingLog(cfg.verboseLogging);
  log.info(`Orchestrator starting; repo URL: ${redactGitUrl(cfg.githubRepoUrl)}`);

  const mutex = new Mutex();
  const app = createAppRunner(cfg, log);

  let phase: OrchestratorPhase = "idle";
  let lastBuildAt: string | null = null;
  let lastError: string | null = null;
  let stopWatcher: (() => void) | null = null;

  async function executeBuildPhase(opts: {
    forceBuild: boolean;
  }): Promise<void> {
    lastError = null;
    await clearBuildFlag(cfg);
    const sync = await syncGitRepository(cfg, log);
    const shouldBuild = opts.forceBuild || sync.buildNeeded;

    if (!shouldBuild) {
      await touchBuildFlag(cfg);
      return;
    }

    await runInstallAndBuild(cfg, cfg.githubRepo, log);
    await touchBuildFlag(cfg);
    lastBuildAt = new Date().toISOString();
  }

  function getSnapshot(): OrchestratorSnapshot {
    return {
      phase,
      gitBranch: cfg.gitBranch,
      repoRoot: cfg.githubRepo,
      currentCommit: readCommitFile(cfg.currentCommitFile),
      remoteCommit: readCommitFile(cfg.lastCommitFile),
      appRunning: app.isRunning(),
      appPid: app.getPid(),
      lastBuildAt,
      lastError,
      watchIntervalMs: cfg.watchIntervalMs,
    };
  }

  const admin = startAdminServer(cfg, {
    getSnapshot,
    getLogs: (n) => log.tail(n),
    triggerRebuild: async () => {
      await mutex.runExclusive(async () => {
        log.info("Admin: forced rebuild");
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
          phase = "idle";
          throw e;
        }
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
    `Admin dashboard at http://${cfg.adminBind}:${cfg.adminPort}/ (container pid ${process.pid}; host loopback http://127.0.0.1:9091/ when compose maps 9091:9090)`,
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

  try {
    phase = "syncing";
    await executeBuildPhase({ forceBuild: false });
    await waitForRunnable(cfg);
    phase = "running";
    await app.start();

    stopWatcher = startCommitWatcher(cfg, log, async () => {
      await mutex.runExclusive(async () => {
        log.info("Rebuild triggered by watcher");
        phase = "building";
        try {
          await executeBuildPhase({ forceBuild: false });
          await waitForRunnable(cfg);
          phase = "running";
          await app.stop();
          await app.start();
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          log.error(lastError);
          phase = "idle";
        }
      });
    });
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    log.error(`Fatal startup error: ${lastError}`);
    process.exit(1);
  }
}

void main();
