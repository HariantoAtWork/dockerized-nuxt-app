import type { AppConfig } from "./config.ts";
import type { OrchestratorSnapshot } from "./types.ts";

export type AdminHandlers = {
  getSnapshot: () => OrchestratorSnapshot;
  getLogs: (n: number) => string[];
  triggerRebuild: () => Promise<void>;
  restartApp: () => Promise<void>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function allowMutation(cfg: AppConfig, req: Request): boolean {
  if (!cfg.adminToken) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${cfg.adminToken}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("token") === cfg.adminToken;
}

function dashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nuxt orchestrator</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; max-width: 52rem; }
    code, pre { background: #f4f4f5; padding: 0.2em 0.4em; border-radius: 4px; }
    pre { padding: 1rem; overflow: auto; }
    button { margin-right: 0.5rem; margin-top: 0.5rem; }
    .err { color: #b91c1c; }
  </style>
</head>
<body>
  <h1>Nuxt orchestrator</h1>
  <p>Loopback admin UI. Mutating actions require <code>ADMIN_TOKEN</code> when set.</p>
  <section id="status"><p>Loading…</p></section>
  <button type="button" id="reload">Refresh status</button>
  <button type="button" id="rebuild">Rebuild</button>
  <button type="button" id="restart">Restart app</button>
  <h2>Recent logs</h2>
  <pre id="logs"></pre>
  <script>
    const token = new URLSearchParams(location.search).get('token') || '';
    async function api(path, opts = {}) {
      const headers = { ...(opts.headers || {}) };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const r = await fetch(path, { ...opts, headers });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
    async function refresh() {
      try {
        const s = await api('/api/status');
        document.getElementById('status').innerHTML =
          '<pre>' + JSON.stringify(s, null, 2) + '</pre>';
      } catch (e) {
        document.getElementById('status').innerHTML = '<p class="err">' + e.message + '</p>';
      }
      try {
        const l = await api('/api/logs?n=120');
        document.getElementById('logs').textContent = l.lines.join('\\n');
      } catch (e) {
        document.getElementById('logs').textContent = String(e);
      }
    }
    document.getElementById('reload').onclick = refresh;
    document.getElementById('rebuild').onclick = async () => {
      try {
        await api('/api/rebuild', { method: 'POST' });
        await refresh();
      } catch (e) { alert(e.message); }
    };
    document.getElementById('restart').onclick = async () => {
      try {
        await api('/api/restart-app', { method: 'POST' });
        await refresh();
      } catch (e) { alert(e.message); }
    };
    refresh();
    setInterval(refresh, 10000);
  </script>
</body>
</html>`;
}

export function startAdminServer(
  cfg: AppConfig,
  handlers: AdminHandlers,
): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    hostname: cfg.adminBind,
    port: cfg.adminPort,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (req.method === "GET" && path === "/") {
        return new Response(dashboardHtml(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      if (req.method === "GET" && path === "/api/status") {
        return json(handlers.getSnapshot());
      }

      if (req.method === "GET" && path === "/api/logs") {
        const n = Number.parseInt(url.searchParams.get("n") ?? "120", 10);
        return json({
          lines: handlers.getLogs(Number.isFinite(n) ? n : 120),
        });
      }

      if (req.method === "POST" && path === "/api/rebuild") {
        if (!allowMutation(cfg, req)) return unauthorized();
        await handlers.triggerRebuild();
        return json({ ok: true });
      }

      if (req.method === "POST" && path === "/api/restart-app") {
        if (!allowMutation(cfg, req)) return unauthorized();
        await handlers.restartApp();
        return json({ ok: true });
      }

      return new Response("Not found", { status: 404 });
    },
  });
}
