export type OrchestratorPhase = "idle" | "syncing" | "building" | "running";

export type OrchestratorSnapshot = {
  phase: OrchestratorPhase;
  gitBranch: string;
  repoRoot: string;
  repoWebUrl: string | null;
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
