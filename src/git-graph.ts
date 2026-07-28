import { runCmd } from "./process.ts";

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

/**
 * Build structured git graph rows so UI can render real lanes and forks.
 */
export async function getGitGraph(
  repoRoot: string,
  limit = 30,
): Promise<GitGraphSnapshot> {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(100, Math.trunc(limit)))
    : 30;

  const { stdout } = await runCmd(
    [
      "git",
      "log",
      "--graph",
      "--decorate=short",
      "--pretty=format:%x00%H%x1f%h%x1f%s%x1f%an%x1f%cr%x1f%D",
      `-${safeLimit}`,
    ],
    repoRoot,
  );

  const rows = stdout
    .split("\n")
    .map((line) => line.replace(/\u001b\[[0-9;]*m/g, ""))
    .filter((line) => line.length > 0)
    .map((line) => {
      const markerAt = line.indexOf("\u0000");
      if (markerAt < 0) {
        return {
          lane: line,
          commit: null,
        };
      }
      const lane = line.slice(0, markerAt);
      const payload = line.slice(markerAt + 1);
      const [hash, shortHash, subject, author, relativeTime, decorate] =
        payload.split("\u001f");
      const refs = (decorate ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return {
        lane,
        commit: {
          hash: hash ?? "",
          shortHash: shortHash ?? "",
          subject: subject ?? "",
          author: author ?? "",
          relativeTime: relativeTime ?? "",
          refs,
        },
      };
    });

  return { rows };
}
