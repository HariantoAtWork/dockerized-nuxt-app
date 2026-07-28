/**
 * Convert common Git remote URL formats to a browsable repository URL.
 * Supports HTTPS remotes and SSH remotes like git@github.com:org/repo.git.
 */
export function toRepoWebUrl(remoteUrl: string): string | null {
  if (!remoteUrl) return null;

  try {
    const https = new URL(remoteUrl);
    if (!https.hostname) return null;
    https.username = "";
    https.password = "";
    https.hash = "";
    https.search = "";
    https.pathname = https.pathname.replace(/\.git$/i, "");
    return https.toString().replace(/\/$/, "");
  } catch {
    // Continue to SSH parser.
  }

  const sshMatch = remoteUrl.match(
    /^git@(?<host>[^:]+):(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/,
  );
  if (!sshMatch?.groups) return null;
  const { host, owner, repo } = sshMatch.groups;
  return `https://${host}/${owner}/${repo}`;
}
