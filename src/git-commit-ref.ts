/** Safe git commit SHAs for checkout (full or abbreviated). */
export function assertValidGitCommit(ref: string): string {
  const sha = ref.trim().toLowerCase();
  if (!sha) throw new Error("Commit SHA is required");
  if (!/^[0-9a-f]{7,40}$/.test(sha)) {
    throw new Error(`Invalid commit SHA: ${ref}`);
  }
  return sha;
}
