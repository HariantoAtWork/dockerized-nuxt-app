export type OrchestratorSnapshot = {
  phase: string;
  gitBranch: string;
  repoRoot: string;
  repoWebUrl: string | null;
  pinnedCommit: string | null;
  currentCommit: string | null;
  currentCommitMessage: string | null;
  remoteCommit: string | null;
  remoteCommitMessage: string | null;
  appRunning: boolean;
  appPid: number | null;
  serverEntryExists: boolean;
  serverEntryPath: string;
  lastBuildAt: string | null;
  lastError: string | null;
  watchIntervalMs: number;
};

export type GitGraphCommit = {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  relativeTime: string;
  refs: string[];
};

export type GitGraphRow = {
  lane: string;
  commit: GitGraphCommit | null;
};

export type GitGraphSnapshot = {
  rows: GitGraphRow[];
};
