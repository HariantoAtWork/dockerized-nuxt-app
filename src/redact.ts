/** Redact credentials embedded in Git HTTPS URLs for safe logging. */
export function redactGitUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "[invalid-url]";
  }
}
