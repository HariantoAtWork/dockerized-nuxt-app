import type { AppConfig } from "./config.ts";
import { isDirectory, isFile } from "./fs-utils.ts";
import type { RingLog } from "./logger.ts";
import { runCmd } from "./process.ts";

type PackageJson = {
  scripts?: Record<string, string>;
};

async function readPackageJson(repoRoot: string): Promise<PackageJson> {
  const path = `${repoRoot}/package.json`;
  const raw = await Bun.file(path).text();
  return JSON.parse(raw) as PackageJson;
}

async function waitForOutput(appOutput: string, log: RingLog): Promise<void> {
  const serverMjs = `${appOutput}/server/index.mjs`;
  log.info(`Waiting for ${serverMjs}...`);
  for (;;) {
    if (isDirectory(appOutput) && isFile(serverMjs)) break;
    await Bun.sleep(2000);
  }
  log.info("Build output ready.");
}

export async function runInstallAndBuild(
  cfg: AppConfig,
  repoRoot: string,
  log: RingLog,
): Promise<void> {
  const pkg = await readPackageJson(repoRoot);
  const scripts = pkg.scripts ?? {};

  log.info("Running bun install...");
  await runCmd(["bun", "install"], repoRoot);

  if (scripts.ci) {
    log.info("Running bun run ci...");
    await runCmd(["bun", "run", "ci"], repoRoot);
  } else if (scripts.build) {
    log.info("No scripts.ci; running bun run build...");
    await runCmd(["bun", "run", "build"], repoRoot);
  } else {
    throw new Error(
      "package.json must define scripts.ci or scripts.build for container builds",
    );
  }

  await waitForOutput(cfg.appOutput, log);
}
