import type { AppConfig } from "./config.ts";
import type { RingLog } from "./logger.ts";
import { isDirectory, isFile } from "./fs-utils.ts";
import { assertValidGitBranch } from "./git-branch.ts";
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

async function checkoutTrackedBranch(
  cfg: AppConfig,
  log: RingLog,
): Promise<void> {
  const repo = cfg.githubRepo;
  const branch = cfg.gitBranch;
  const remoteRef = `origin/${branch}`;
  log.info(`Checking out ${remoteRef}...`);
  await runCmd(["git", "fetch", "origin"], repo);
  await runCmd(["git", "checkout", "-B", branch, remoteRef], repo);
  await runCmd(["git", "clean", "-fd"], repo);
}

export async function persistGitBranch(
  cfg: AppConfig,
  branch: string,
): Promise<void> {
  const safe = assertValidGitBranch(branch);
  cfg.gitBranch = safe;
  await writeTextFile(cfg.gitBranchFile, `${safe}\n`);
}

export async function listRemoteBranches(
  cfg: AppConfig,
): Promise<string[]> {
  const repo = cfg.githubRepo;
  if (!isDirectory(repo) || !isDirectory(`${repo}/.git`)) {
    return [cfg.gitBranch];
  }
  await runCmd(["git", "fetch", "origin"], repo, { throwOnError: false });
  let stdout = (
    await runCmd(
      ["git", "branch", "-r", "--format=%(refname:short)"],
      repo,
      { throwOnError: false },
    )
  ).stdout;
  if (!stdout.trim()) {
    stdout = (
      await runCmd(["git", "branch", "-r"], repo, { throwOnError: false })
    ).stdout;
  }
  const branches = new Set<string>();
  for (const line of stdout.split("\n")) {
    const ref = line.trim().replace(/^\*\s*/, "");
    if (!ref || ref.includes("->") || ref === "origin/HEAD") continue;
    const name = ref.startsWith("origin/") ? ref.slice("origin/".length) : ref;
    if (!name) continue;
    try {
      branches.add(assertValidGitBranch(name));
    } catch {
      /* skip odd refs */
    }
  }
  if (branches.size === 0) branches.add(cfg.gitBranch);
  return [...branches].sort((a, b) => a.localeCompare(b));
}

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

  const readPorcelainConflicts = async (): Promise<boolean> => {
    const { stdout } = await runCmd(["git", "status", "--porcelain"], repo, {
      throwOnError: false,
    });
    return /^UU|^AA|^DD/m.test(stdout);
  };

  if (isDirectory(repo) && isDirectory(`${repo}/.git`)) {
    log.info(`Repository exists. Tracking ${remoteRef}...`);
    currentCommit = (await runCmd(["git", "rev-parse", "HEAD"], repo)).stdout
      .trim();
    await writeTextFile(cfg.currentCommitFile, `${currentCommit}\n`);

    await runCmd(["git", "fetch", "origin"], repo);

    const remoteProbe = await runCmd(["git", "rev-parse", remoteRef], repo, {
      throwOnError: false,
    });
    if (remoteProbe.code !== 0) {
      throw new Error(`Remote branch not found: ${remoteRef}`);
    }
    remoteCommit = remoteProbe.stdout.trim();
    await writeTextFile(cfg.lastCommitFile, `${remoteCommit}\n`);

    const currentBranch = (
      await runCmd(["git", "rev-parse", "--abbrev-ref", "HEAD"], repo, {
        throwOnError: false,
      })
    ).stdout.trim();
    const onWrongBranch =
      currentBranch !== branch && currentBranch !== "HEAD";

    if (currentCommit !== remoteCommit || onWrongBranch) {
      log.info("Working tree out of date or on another branch; syncing...");
      await checkoutTrackedBranch(cfg, log);
      const conflicts = await readPorcelainConflicts();
      if (conflicts) {
        log.warn("Merge conflicts detected after sync; skipping build trigger.");
      } else {
        log.info("Repository updated successfully.");
        buildNeeded = true;
      }
      currentCommit = (
        await runCmd(["git", "rev-parse", "HEAD"], repo)
      ).stdout.trim();
      await writeTextFile(cfg.currentCommitFile, `${currentCommit}\n`);
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
    await checkoutTrackedBranch(cfg, log);
    buildNeeded = true;
    currentCommit = (
      await runCmd(["git", "rev-parse", "HEAD"], repo)
    ).stdout.trim();
    remoteCommit = (
      await runCmd(["git", "rev-parse", remoteRef], repo)
    ).stdout.trim();
    await writeTextFile(cfg.currentCommitFile, `${currentCommit}\n`);
    await writeTextFile(cfg.lastCommitFile, `${remoteCommit}\n`);
  } else {
    log.info("Cloning repository for the first time...");
    await runCmd(["git", "clone", cfg.githubRepoUrl, repo], "/");
    await checkoutTrackedBranch(cfg, log);
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
