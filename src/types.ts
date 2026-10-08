export type OrchestratorPhase = "idle" | "syncing" | "building" | "running";

/** Lifecycle shown on admin LED lanes. */
export type LaneLifecycle = "starting" | "running" | "done" | "fail";

export type StatusLaneId = "git" | "build" | "nodemon";

export type StatusLane = {
  id: StatusLaneId;
  title: string;
  status: LaneLifecycle;
  detail: string;
};

export type StatusLanes = {
  git: StatusLane;
  build: StatusLane;
  nodemon: StatusLane;
};

export type OrchestratorSnapshot = {
  phase: OrchestratorPhase;
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
  lastErrorPhase: OrchestratorPhase | null;
  lanes: StatusLanes;
  watchIntervalMs: number;
};
