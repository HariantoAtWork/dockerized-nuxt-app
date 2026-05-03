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
    #toast-host {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-end;
      pointer-events: none;
    }
    .toast {
      max-width: 22rem;
      padding: 0.65rem 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      font-size: 0.9rem;
      line-height: 1.35;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.28s ease, transform 0.28s ease;
      pointer-events: auto;
    }
    .toast-visible { opacity: 1; transform: translateY(0); }
    .toast-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .toast-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .toast-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
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
  <div id="toast-host" aria-live="polite"></div>
  <script>
    const token = new URLSearchParams(location.search).get('token') || '';
    function showToast(message, variant) {
      const host = document.getElementById('toast-host');
      const el = document.createElement('div');
      el.className = 'toast toast-' + (variant || 'info');
      el.textContent = message;
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add('toast-visible'));
      const dismissMs = variant === 'error' ? 7000 : 4500;
      setTimeout(() => {
        el.classList.remove('toast-visible');
        setTimeout(() => el.remove(), 320);
      }, dismissMs);
    }
    async function api(path, opts = {}) {
      const headers = { ...(opts.headers || {}) };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const r = await fetch(path, { ...opts, headers });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
    async function refresh(opts) {
      const silent = opts && opts.silent;
      let ok = true;
      try {
        const s = await api('/api/status');
        document.getElementById('status').innerHTML =
          '<pre>' + JSON.stringify(s, null, 2) + '</pre>';
      } catch (e) {
        ok = false;
        document.getElementById('status').innerHTML = '<p class="err">' + e.message + '</p>';
        if (!silent) showToast(e.message, 'error');
      }
      try {
        const l = await api('/api/logs?n=120');
        document.getElementById('logs').textContent = l.lines.join('\\n');
      } catch (e) {
        ok = false;
        document.getElementById('logs').textContent = String(e);
      }
      return ok;
    }
    document.getElementById('reload').onclick = async () => {
      if (await refresh({})) showToast('Status refreshed', 'success');
    };
    document.getElementById('rebuild').onclick = async () => {
      try {
        await api('/api/rebuild', { method: 'POST' });
        showToast('Rebuild finished', 'success');
        await refresh();
      } catch (e) {
        showToast(e.message || String(e), 'error');
      }
    };
    document.getElementById('restart').onclick = async () => {
      try {
        await api('/api/restart-app', { method: 'POST' });
        showToast('App restarted', 'success');
        await refresh();
      } catch (e) {
        showToast(e.message || String(e), 'error');
      }
    };
    refresh({});
    setInterval(() => { refresh({ silent: true }); }, 10000);
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
