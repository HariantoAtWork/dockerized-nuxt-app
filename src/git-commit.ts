import { runCmd } from "./process.ts";

/** Subject line for a commit SHA, or null if unavailable. */
export async function commitSubject(
  repo: string,
  sha: string | null | undefined,
): Promise<string | null> {
  if (!sha) return null;
  const { code, stdout } = await runCmd(
    ["git", "log", "-1", "--format=%s", sha],
    repo,
    { throwOnError: false },
  );
  if (code !== 0) return null;
  const subject = stdout.trim();
  return subject || null;
}

export function shortSha(sha: string | null | undefined): string {
  if (!sha) return "unknown";
  return sha.slice(0, 7);
}
