import type {
  LaneLifecycle,
  OrchestratorPhase,
  StatusLane,
  StatusLanes,
} from "./types.ts";

export type LaneDeriveInput = {
  phase: OrchestratorPhase;
  lastError: string | null;
  lastErrorPhase: OrchestratorPhase | null;
  currentCommit: string | null;
  serverEntryExists: boolean;
  lastBuildAt: string | null;
  appRunning: boolean;
  appPid: number | null;
};

function shortSha(sha: string | null): string | null {
  if (!sha) return null;
  return sha.slice(0, 7);
}

function truncate(msg: string, max = 72): string {
  const t = msg.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function lane(
  id: StatusLane["id"],
  title: string,
  status: LaneLifecycle,
  detail: string,
): StatusLane {
  return { id, title, status, detail };
}

export function deriveStatusLanes(input: LaneDeriveInput): StatusLanes {
  const {
    phase,
    lastError,
    lastErrorPhase,
    currentCommit,
    serverEntryExists,
    lastBuildAt,
    appRunning,
    appPid,
  } = input;

  const err = lastError ? truncate(lastError) : null;
  const sha = shortSha(currentCommit);

  let git: StatusLane;
  if (phase === "syncing") {
    git = lane("git", "Git", "running", "Syncing repository…");
  } else if (err && lastErrorPhase === "syncing") {
    git = lane("git", "Git", "fail", err);
  } else if (sha) {
    git = lane("git", "Git", "done", `At ${sha}`);
  } else if (phase === "idle") {
    git = lane("git", "Git", "starting", "Waiting to sync…");
  } else {
    git = lane("git", "Git", "starting", "Preparing checkout…");
  }

  let build: StatusLane;
  if (phase === "building") {
    build = lane("build", "Build", "running", "Install & build in progress…");
  } else if (err && lastErrorPhase === "building") {
    build = lane("build", "Build", "fail", err);
  } else if (serverEntryExists) {
    const when = lastBuildAt
      ? new Date(lastBuildAt).toLocaleString("en-GB", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null;
    build = lane(
      "build",
      "Build",
      "done",
      when ? `Ready · ${when}` : "Entry present",
    );
  } else if (phase === "syncing") {
    build = lane("build", "Build", "starting", "Waiting for sync…");
  } else {
    build = lane("build", "Build", "starting", "Waiting for output…");
  }

  let nodemon: StatusLane;
  if (appRunning) {
    nodemon = lane(
      "nodemon",
      "Nodemon",
      "running",
      appPid != null ? `pid ${appPid}` : "Process up",
    );
  } else if (!serverEntryExists) {
    nodemon = lane("nodemon", "Nodemon", "starting", "Waiting for entry…");
  } else if (err && (lastErrorPhase === "running" || lastErrorPhase === "idle")) {
    nodemon = lane("nodemon", "Nodemon", "fail", err);
  } else if (phase === "running" || phase === "building" || phase === "syncing") {
    nodemon = lane("nodemon", "Nodemon", "starting", "Starting process…");
  } else {
    nodemon = lane("nodemon", "Nodemon", "fail", "Stopped");
  }

  return { git, build, nodemon };
}
