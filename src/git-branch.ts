/** Safe branch names for checkout / origin refs (no shell metacharacters). */
export function assertValidGitBranch(name: string): string {
  const branch = name.trim();
  if (!branch) throw new Error("Branch name is required");
  if (branch.length > 200) throw new Error("Branch name is too long");
  if (branch.includes("..") || branch.startsWith("/") || branch.endsWith("/")) {
    throw new Error(`Invalid branch name: ${branch}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)) {
    throw new Error(`Invalid branch name: ${branch}`);
  }
  return branch;
}
