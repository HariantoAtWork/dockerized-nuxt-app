export type OrchestratorPhase = "idle" | "syncing" | "building" | "running";

export type OrchestratorSnapshot = {
  phase: OrchestratorPhase;
  gitBranch: string;
  repoRoot: string;
  currentCommit: string | null;
  remoteCommit: string | null;
  appRunning: boolean;
  appPid: number | null;
  lastBuildAt: string | null;
  lastError: string | null;
  watchIntervalMs: number;
};
