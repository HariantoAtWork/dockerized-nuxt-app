import type { AppConfig } from "./config.ts";
import { isFile } from "./fs-utils.ts";
import type { LineRing, RingLog } from "./logger.ts";

export type AppRunner = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getPid: () => number | null;
};

async function pumpChildStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  channel: "stdout" | "stderr",
  appLog: LineRing,
): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  const flushLine = (raw: string) => {
    const line = raw.replace(/\r$/, "");
    const stamped = `${new Date().toISOString()} [${channel}] ${line}`;
    appLog.push(stamped);
    if (channel === "stderr") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const parts = pending.split("\n");
      pending = parts.pop() ?? "";
      for (const part of parts) flushLine(part);
    }
    pending += decoder.decode();
    if (pending) flushLine(pending);
  } catch {
    /* process killed / stream closed */
  }
}

export function createAppRunner(
  cfg: AppConfig,
  log: RingLog,
  appLog: LineRing,
): AppRunner {
  let child: ReturnType<typeof Bun.spawn> | null = null;
  const serverEntry = `${cfg.appOutput}/server/index.mjs`;

  async function stopQuiet(): Promise<void> {
    if (!child) return;
    const c = child;
    child = null;
    try {
      c.kill();
    } catch {
      /* ignore */
    }
    try {
      await Promise.race([
        c.exited,
        Bun.sleep(8000).then(() => {
          try {
            c.kill(9);
          } catch {
            /* ignore */
          }
        }),
      ]);
    } catch {
      /* ignore */
    }
  }

  async function waitForServerEntry(): Promise<void> {
    if (isFile(serverEntry)) return;
    log.info(`Waiting for ${serverEntry} before nodemon...`);
    while (!isFile(serverEntry)) {
      await Bun.sleep(2000);
    }
  }

  return {
    isRunning: () => child !== null,
    getPid: () => child?.pid ?? null,

    start: async () => {
      await stopQuiet();
      await waitForServerEntry();
      log.info(`Starting nodemon for ${serverEntry}...`);
      child = Bun.spawn(
        [
          "nodemon",
          "--exec",
          "bun",
          "--watch",
          serverEntry,
          "--cwd",
          cfg.appOutput,
          serverEntry,
        ],
        {
          cwd: cfg.appOutput,
          stdout: "pipe",
          stderr: "pipe",
          env: process.env,
        },
      );
      void pumpChildStream(child.stdout, "stdout", appLog);
      void pumpChildStream(child.stderr, "stderr", appLog);
      void child.exited.then((code) => {
        log.warn(`Application process exited with code ${code}`);
        child = null;
      });
    },

    stop: stopQuiet,
  };
}
