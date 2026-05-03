import path from "node:path";

/** Production dashboard assets live under `<cwd>/static` (Vue build output). */
export async function tryServeStatic(
  pathname: string,
): Promise<Response | null> {
  const root = path.resolve(process.cwd(), "static");
  const indexPath = path.join(root, "index.html");
  if (!(await Bun.file(indexPath).exists())) return null;

  const rel = pathname.replace(/^\/+/, "") || "index.html";
  const candidate = path.resolve(root, rel);

  if (
    !(candidate === root || candidate.startsWith(root + path.sep))
  ) {
    return null;
  }

  let file = Bun.file(candidate);
  if (await file.exists()) {
    const st = await file.stat();
    if (st.isDirectory()) {
      file = Bun.file(path.join(candidate, "index.html"));
    }
  }

  if (await file.exists()) {
    return new Response(file);
  }

  if (!rel.includes(".")) {
    return new Response(Bun.file(indexPath));
  }

  return null;
}

export function staticDashboardMissingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Orchestrator admin</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:40rem">
<h1>Admin UI not built</h1>
<p>Run <code>bun install</code> and <code>bun run build</code> in <code>admin-ui/</code>, then copy <code>admin-ui/dist</code> to <code>static/</code> beside the orchestrator, or rebuild the Docker image.</p>
</body></html>`;
}
