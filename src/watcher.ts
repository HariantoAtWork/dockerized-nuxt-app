import type { AppConfig } from "./config.ts";
import { commitSubject, shortSha } from "./git-commit.ts";
import type { RingLog } from "./logger.ts";
import { runCmd } from "./process.ts";

/** Polls Git for new commits and invokes onUpdate when remote moves ahead. */
export function startCommitWatcher(
  cfg: AppConfig,
  log: RingLog,
  onUpdate: () => Promise<void>,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick() {
    try {
      const repo = cfg.githubRepo;
      const remoteRef = `origin/${cfg.gitBranch}`;
      await runCmd(["git", "reset", "--hard", "HEAD"], repo);

      const current = (
        await runCmd(["git", "rev-parse", "HEAD"], repo)
      ).stdout.trim();
      await runCmd(["git", "fetch", "origin"], repo);
      const latest = (
        await runCmd(["git", "rev-parse", remoteRef], repo)
      ).stdout.trim();

      if (current !== latest) {
        const subject = await commitSubject(repo, latest);
        const subjectPart = subject ? ` “${subject}”` : "";
        log.info(
          `Watcher: new commits on ${cfg.gitBranch} (${shortSha(current)} → ${shortSha(latest)}${subjectPart}); rebuilding…`,
        );
        await onUpdate();
      } else if (cfg.verboseLogging) {
        log.info(`Watcher: no new commits on ${cfg.gitBranch}.`);
      }
    } catch (e) {
      log.error(
        `Watcher tick failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  timer = setInterval(() => {
    void tick();
  }, cfg.watchIntervalMs);

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
