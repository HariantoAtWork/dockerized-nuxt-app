import { readFileSync } from "node:fs";

export type AppConfig = {
  appRoot: string;
  githubRepo: string;
  githubRepoUrl: string;
  appOutput: string;
  appBuildDir: string;
  buildCompleteFlag: string;
  currentCommitFile: string;
  lastCommitFile: string;
  gitBranchFile: string;
  /** Mutable at runtime when switching branches from the admin UI. */
  gitBranch: string;
  verboseLogging: boolean;
  adminBind: string;
  adminPort: number;
  adminToken: string | null;
  watchIntervalMs: number;
};

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

function envInt(name: string, defaultValue: number): number {
  const v = process.env[name];
  if (!v) return defaultValue;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function readPersistedBranch(path: string): string | null {
  try {
    const t = readFileSync(path, "utf8").trim();
    return t || null;
  } catch {
    return null;
  }
}

export function loadConfig(): AppConfig {
  const githubRepoUrl = process.env.GITHUB_REPO_URL ?? "";
  const appRoot = process.env.APP_ROOT ?? "/app";
  const githubRepo = process.env.GITHUB_REPO ?? appRoot;
  const gitBranchFile =
    process.env.GIT_BRANCH_FILE ?? `${appRoot}/.orchestrator_git_branch`;

  return {
    appRoot,
    githubRepo,
    githubRepoUrl,
    appOutput: process.env.APP_OUTPUT ?? `${appRoot}/.output`,
    appBuildDir: process.env.APP_BUILD ?? `${githubRepo}/.output`,
    buildCompleteFlag:
      process.env.BUILD_COMPLETE_FLAG ?? `${appRoot}/.build-complete.flag`,
    currentCommitFile:
      process.env.CURRENT_COMMIT_FILE ?? `${appRoot}/.current_commit`,
    lastCommitFile: process.env.LAST_COMMIT_FILE ?? `${appRoot}/.last_commit`,
    gitBranchFile,
    gitBranch:
      readPersistedBranch(gitBranchFile) ??
      process.env.GIT_BRANCH ??
      "main",
    verboseLogging: envBool("VERBOSE_LOGGING", true),
    adminBind: process.env.ADMIN_BIND ?? "0.0.0.0",
    adminPort: envInt("ADMIN_PORT", 9090),
    adminToken: process.env.ADMIN_TOKEN?.trim() || null,
    watchIntervalMs: envInt("WATCH_INTERVAL_MS", 60_000),
  };
}
