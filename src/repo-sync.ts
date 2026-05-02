import type { AppConfig } from "./config.ts";
import type { RingLog } from "./logger.ts";
import { exists, isDirectory, isFile } from "./fs-utils.ts";
import { runCmd } from "./process.ts";

async function writeTextFile(path: string, content: string) {
  await Bun.write(path, content);
}

async function rmIfExists(path: string) {
  try {
    await Bun.file(path).delete();
  } catch {
    /* ignore */
  }
}

export type SyncResult = {
  buildNeeded: boolean;
  currentCommit: string | null;
  remoteCommit: string | null;
};

export async function syncGitRepository(
  cfg: AppConfig,
  log: RingLog,
): Promise<SyncResult> {
  const repo = cfg.githubRepo;
  const branch = cfg.gitBranch;
  const remoteRef = `origin/${branch}`;

  let buildNeeded = false;
  let currentCommit: string | null = null;
  let remoteCommit: string | null = null;

  const forcePull = async () => {
    log.info(`Force pulling ${remoteRef}...`);
    await runCmd(["git", "fetch", "origin"], repo);
    await runCmd(["git", "reset", "--hard", remoteRef], repo);
    await runCmd(["git", "clean", "-fd"], repo);
  };

  const readPorcelainConflicts = async (): Promise<boolean> => {
    const { stdout } = await runCmd(["git", "status", "--porcelain"], repo, {
      throwOnError: false,
    });
    return /^UU|^AA|^DD/m.test(stdout);
  };

  if (isDirectory(repo) && isDirectory(`${repo}/.git`)) {
    log.info("Repository exists. Checking for updates...");
    currentCommit = (await runCmd(["git", "rev-parse", "HEAD"], repo)).stdout
      .trim();
    await writeTextFile(cfg.currentCommitFile, `${currentCommit}\n`);

    await runCmd(["git", "fetch", "origin"], repo);

    remoteCommit = (
      await runCmd(["git", "rev-parse", remoteRef], repo)
    ).stdout.trim();
    await writeTextFile(cfg.lastCommitFile, `${remoteCommit}\n`);

    if (currentCommit !== remoteCommit) {
      log.info("New commits detected; syncing working tree...");
      await runCmd(["git", "reset", "--hard", "HEAD"], repo);
      await forcePull();
      const conflicts = await readPorcelainConflicts();
      if (conflicts) {
        log.warn("Merge conflicts detected after sync; skipping build trigger.");
      } else {
        log.info("Repository updated successfully.");
        buildNeeded = true;
      }
    } else {
      log.info("Repository is up to date.");
      const outMjs = `${cfg.appBuildDir}/server/index.mjs`;
      const hasOutput = isDirectory(cfg.appBuildDir) && isFile(outMjs);
      if (!hasOutput) {
        log.info("Build output missing or incomplete; rebuild needed.");
        buildNeeded = true;
      }
    }
  } else if (isDirectory(repo) && !isDirectory(`${repo}/.git`)) {
    log.info("Folder exists without .git; recovering repository...");
    const temp = `/tmp/orch-git-recovery-${process.pid}`;
    await runCmd(["git", "clone", cfg.githubRepoUrl, temp], "/");
    await runCmd(["sh", "-c", `mv "${temp}/.git" "${repo}/.git"`], "/");
    await runCmd(["rm", "-rf", temp], "/");
    await runCmd(["git", "reset", "--hard", "HEAD"], repo);
    await runCmd(["git", "clean", "-fd"], repo);
    buildNeeded = true;
    currentCommit = (
      await runCmd(["git", "rev-parse", "HEAD"], repo)
    ).stdout.trim();
    await runCmd(["git", "fetch", "origin"], repo);
    remoteCommit = (
      await runCmd(["git", "rev-parse", remoteRef], repo)
    ).stdout.trim();
    await writeTextFile(cfg.currentCommitFile, `${currentCommit}\n`);
    await writeTextFile(cfg.lastCommitFile, `${remoteCommit}\n`);
  } else {
    log.info("Cloning repository for the first time...");
    await runCmd(["git", "clone", cfg.githubRepoUrl, repo], "/");
    await runCmd(["git", "fetch", "origin"], repo);
    currentCommit = (
      await runCmd(["git", "rev-parse", "HEAD"], repo)
    ).stdout.trim();
    remoteCommit = (
      await runCmd(["git", "rev-parse", remoteRef], repo)
    ).stdout.trim();
    await writeTextFile(cfg.currentCommitFile, `${currentCommit}\n`);
    await writeTextFile(cfg.lastCommitFile, `${remoteCommit}\n`);
    buildNeeded = true;
  }

  return { buildNeeded, currentCommit, remoteCommit };
}

/** Remove build-complete flag at start of a build (matches legacy docker-build.sh). */
export async function clearBuildFlag(cfg: AppConfig): Promise<void> {
  await rmIfExists(cfg.buildCompleteFlag);
}

export async function touchBuildFlag(cfg: AppConfig): Promise<void> {
  await Bun.write(cfg.buildCompleteFlag, "");
}
