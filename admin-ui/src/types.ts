export type OrchestratorSnapshot = {
  phase: string;
  gitBranch: string;
  repoRoot: string;
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
