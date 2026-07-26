import type { AppConfig } from "./config.ts";
import { isFile } from "./fs-utils.ts";
import type { RingLog } from "./logger.ts";

export type AppRunner = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getPid: () => number | null;
};

const SERVER_ENTRY = ".output/server/index.mjs";

export function createAppRunner(cfg: AppConfig, log: RingLog): AppRunner {
  let child: ReturnType<typeof Bun.spawn> | null = null;

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
    const absoluteEntry = `${cfg.appOutput}/server/index.mjs`;
    if (isFile(absoluteEntry)) return;
    log.info(`Waiting for ${SERVER_ENTRY} before nodemon...`);
    while (!isFile(absoluteEntry)) {
      await Bun.sleep(2000);
    }
  }

  return {
    isRunning: () => child !== null,
    getPid: () => child?.pid ?? null,

    start: async () => {
      await stopQuiet();
      await waitForServerEntry();
      log.info(`Starting nodemon for ${SERVER_ENTRY}...`);
      child = Bun.spawn(
        [
          "nodemon",
          "--watch",
          cfg.appOutput,
          "--cwd",
          cfg.appRoot,
          SERVER_ENTRY,
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
