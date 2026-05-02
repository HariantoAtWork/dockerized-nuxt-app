import type { AppConfig } from "./config.ts";
import type { RingLog } from "./logger.ts";

export type AppRunner = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getPid: () => number | null;
};

export function createAppRunner(cfg: AppConfig, log: RingLog): AppRunner {
  let child: ReturnType<typeof Bun.spawn> | null = null;

  async function stopQuiet(): Promise<void> {
    if (!child) return;
    const c = child;
    child = null;
    try {
      c.kill();
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

  return {
    isRunning: () => child !== null,
    getPid: () => child?.pid ?? null,

    start: async () => {
      await stopQuiet();
      log.info("Starting nodemon for Nuxt server...");
      child = Bun.spawn(
        [
          "nodemon",
          "--watch",
          cfg.appOutput,
          "--cwd",
          cfg.appRoot,
          ".output/server/index.mjs",
        ],
        {
          cwd: cfg.appRoot,
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
