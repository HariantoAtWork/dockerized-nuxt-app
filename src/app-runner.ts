import type { AppConfig } from "./config.ts";
import { isFile } from "./fs-utils.ts";
import type { RingLog } from "./logger.ts";

export type AppRunner = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getPid: () => number | null;
};

export function createAppRunner(cfg: AppConfig, log: RingLog): AppRunner {
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
          stdout: "inherit",
          stderr: "inherit",
          env: process.env,
        },
      );
      void child.exited.then((code) => {
        log.warn(`Application process exited with code ${code}`);
        child = null;
      });
    },

    stop: stopQuiet,
  };
}
