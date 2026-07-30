import type { GitGraphCommit, GitGraphRow } from "../types.ts";

export const LANE_COLORS = [
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#0891b2",
  "#d97706",
  "#db2777",
  "#4f46e5",
  "#0d9488",
] as const;

const COMMIT_ROW_BASE_H = 58;
const CONNECTOR_ROW_H = 14;
const CHAR_W = 9;
const PAD_X = 12;
const STROKE = 2;
const NODE_R = 5;
/** Align nodes with the commit title: content padding-top (~0.55rem) + half subject line. */
export const TITLE_NODE_OFFSET = 18;
const REFS_ROW_H = 28;
const TAGS_ROW_H = 28;
const ACTION_ROW_H = 30;
const ROW_GAP_PAD = 10;

export type GraphSegment = {
  d: string;
  color: string;
};

export type GraphRowNode = {
  cx: number;
  cy: number;
  color: string;
};

export type GraphRowLayout = {
  index: number;
  height: number;
  commit: GitGraphCommit | null;
  lane: string;
  segments: GraphSegment[];
  node: GraphRowNode | null;
};

export type GitGraphLayout = {
  width: number;
  rowLayouts: GraphRowLayout[];
};

function laneColor(col: number): string {
  return LANE_COLORS[col % LANE_COLORS.length] ?? LANE_COLORS[0];
}

function charToCol(charIndex: number): number {
  return Math.floor(charIndex / 2);
}

/** Horizontal centre of a graph character column, relative to the used lane span. */
function xAt(charIndex: number, origin: number): number {
  return PAD_X + (charIndex - origin) * CHAR_W + CHAR_W / 2;
}

function lastNonSpaceIndex(lane: string, before: number): number {
  for (let i = before - 1; i >= 0; i--) {
    if (lane[i] !== " ") return i;
  }
  return -1;
}

function nextNonSpaceIndex(lane: string, after: number): number {
  for (let i = after + 1; i < lane.length; i++) {
    if (lane[i] !== " ") return i;
  }
  return -1;
}

/** Ignore trailing/leading spaces so width matches drawn forks only. */
function laneExtent(rows: GitGraphRow[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    for (let i = 0; i < row.lane.length; i++) {
      if (row.lane[i] !== " ") {
        min = Math.min(min, i);
        max = Math.max(max, i);
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }
  return { min, max };
}

function elbowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius = 6,
): string {
  if (Math.abs(x1 - x2) < 0.5) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  if (Math.abs(y1 - y2) < 0.5) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const dirY = y2 > y1 ? 1 : -1;
  const dirX = x2 > x1 ? 1 : -1;
  const r = Math.min(radius, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2);
  const cornerY = y2 - dirY * r;
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${cornerY}`,
    `Q ${x1} ${y2} ${x1 + dirX * r} ${y2}`,
    `L ${x2 - dirX * r} ${y2}`,
    `Q ${x2} ${y2} ${x2} ${y2 + dirY * r}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

function estimateCommitRowHeight(
  commit: GitGraphCommit,
  markers?: { currentCommit: string | null; remoteCommit: string | null },
): number {
  let height = COMMIT_ROW_BASE_H + ROW_GAP_PAD + ACTION_ROW_H;
  if (commit.refs.length > 0) height += REFS_ROW_H;
  const isCurrent = markers?.currentCommit === commit.hash;
  const isRemote = markers?.remoteCommit === commit.hash;
  if (isCurrent || isRemote) height += TAGS_ROW_H;
  return height;
}

function buildRowGeometry(
  lane: string,
  height: number,
  origin: number,
  opts: {
    hasCommit: boolean;
    hasPrev: boolean;
    hasNext: boolean;
  },
): { segments: GraphSegment[]; node: GraphRowNode | null } {
  const segments: GraphSegment[] = [];
  let node: GraphRowNode | null = null;
  const nodeY = opts.hasCommit ? TITLE_NODE_OFFSET : height / 2;
  const at = (i: number) => xAt(i, origin);

  for (let i = 0; i < lane.length; i++) {
    const ch = lane[i];
    if (ch === " ") continue;

    const x = at(i);
    const color = laneColor(charToCol(i));

    if (ch === "|") {
      segments.push({
        d: `M ${x} 0 L ${x} ${height}`,
        color,
      });
    } else if (ch === "-") {
      const j = nextNonSpaceIndex(lane, i);
      if (j >= 0) {
        segments.push({
          d: `M ${x} ${nodeY} L ${at(j)} ${nodeY}`,
          color,
        });
      }
    } else if (ch === "_") {
      const j = lastNonSpaceIndex(lane, i);
      if (j >= 0) {
        segments.push({
          d: `M ${at(j)} ${nodeY} L ${x} ${nodeY}`,
          color,
        });
      }
    } else if (ch === "\\") {
      const j = lastNonSpaceIndex(lane, i + 1);
      const fromIdx = j >= 0 ? j : Math.max(0, i - 2);
      segments.push({
        d: elbowPath(at(fromIdx), 0, x, height),
        color,
      });
    } else if (ch === "/") {
      const j = nextNonSpaceIndex(lane, i);
      const toIdx = j >= 0 ? j : Math.min(lane.length - 1, i + 2);
      segments.push({
        d: elbowPath(x, 0, at(toIdx), height),
        color,
      });
    } else if (ch === "*") {
      if (opts.hasPrev) {
        segments.push({
          d: `M ${x} 0 L ${x} ${nodeY}`,
          color,
        });
      }
      if (opts.hasNext) {
        segments.push({
          d: `M ${x} ${nodeY} L ${x} ${height}`,
          color,
        });
      }
      if (opts.hasCommit) {
        node = { cx: x, cy: nodeY, color };
      }
    }
  }

  return { segments, node };
}

export function buildGitGraphLayout(
  rows: GitGraphRow[],
  opts?: {
    currentCommit?: string | null;
    remoteCommit?: string | null;
  },
): GitGraphLayout {
  const markers = {
    currentCommit: opts?.currentCommit ?? null,
    remoteCommit: opts?.remoteCommit ?? null,
  };

  const { min: origin, max: lastCol } = laneExtent(rows);
  const colCount = Math.max(lastCol - origin + 1, 1);
  const width = colCount * CHAR_W + PAD_X * 2;

  const rowLayouts: GraphRowLayout[] = rows.map((row, index) => {
    const height = row.commit
      ? estimateCommitRowHeight(row.commit, markers)
      : CONNECTOR_ROW_H;

    const { segments, node } = buildRowGeometry(row.lane, height, origin, {
      hasCommit: Boolean(row.commit),
      hasPrev: index > 0,
      hasNext: index < rows.length - 1,
    });

    return {
      index,
      height,
      commit: row.commit,
      lane: row.lane,
      segments,
      node,
    };
  });

  return {
    width,
    rowLayouts,
  };
}

export { CONNECTOR_ROW_H, NODE_R, STROKE };
