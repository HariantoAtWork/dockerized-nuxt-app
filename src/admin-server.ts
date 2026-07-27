import type { AppConfig } from "./config.ts";
import type { OrchestratorSnapshot } from "./types.ts";
import { staticDashboardMissingHtml, tryServeStatic } from "./static-serve.ts";

export type AdminHandlers = {
  getSnapshot: () => OrchestratorSnapshot;
  getLogs: (n: number) => string[];
  listBranches: () => Promise<{ current: string; branches: string[] }>;
  switchBranch: (branch: string) => Promise<void>;
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

export function startAdminServer(
  cfg: AppConfig,
  handlers: AdminHandlers,
): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    hostname: cfg.adminBind,
    port: cfg.adminPort,
    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/api/status") {
        return json(handlers.getSnapshot());
      }

      if (req.method === "GET" && pathname === "/api/logs") {
        const n = Number.parseInt(url.searchParams.get("n") ?? "120", 10);
        return json({
          lines: handlers.getLogs(Number.isFinite(n) ? n : 120),
        });
      }

      if (req.method === "GET" && pathname === "/api/branches") {
        return json(await handlers.listBranches());
      }

      if (req.method === "POST" && pathname === "/api/branch") {
        if (!allowMutation(cfg, req)) return unauthorized();
        let body: { branch?: unknown };
        try {
          body = (await req.json()) as { branch?: unknown };
        } catch {
          return json({ error: "Expected JSON body with branch" }, 400);
        }
        if (typeof body.branch !== "string") {
          return json({ error: "branch must be a string" }, 400);
        }
        await handlers.switchBranch(body.branch);
        return json({ ok: true, branch: cfg.gitBranch });
      }

      if (req.method === "POST" && pathname === "/api/rebuild") {
        if (!allowMutation(cfg, req)) return unauthorized();
        await handlers.triggerRebuild();
        return json({ ok: true });
      }

      if (req.method === "POST" && pathname === "/api/restart-app") {
        if (!allowMutation(cfg, req)) return unauthorized();
        await handlers.restartApp();
        return json({ ok: true });
      }

      if (req.method === "GET") {
        const staticResponse = await tryServeStatic(pathname);
        if (staticResponse) return staticResponse;
        return new Response(staticDashboardMissingHtml(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });
}
