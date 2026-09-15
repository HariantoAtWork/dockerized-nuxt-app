import type { AppConfig } from "./config.ts";
import { isDirectory, isFile } from "./fs-utils.ts";
import type { RingLog } from "./logger.ts";
import { runCmd } from "./process.ts";

type PackageJson = {
  scripts?: Record<string, string>;
};

async function readPackageJson(repoRoot: string): Promise<PackageJson> {
  const path = `${repoRoot}/package.json`;
  if (!isFile(path)) {
    throw new Error(
      `${path} not found; waiting for a complete checkout before build`,
    );
  }
  const raw = await Bun.file(path).text();
  return JSON.parse(raw) as PackageJson;
}

/**
 * Nuxt/Nitro writes `<repo>/.output` by default. Publish once into APP_OUTPUT (/app).
 * No watch/debounce — single rsync after the source entry exists.
 */
async function publishBuildOutput(
  cfg: AppConfig,
  repoRoot: string,
  log: RingLog,
): Promise<void> {
  const nitroDefault = `${repoRoot}/.output`;
  const srcEntry = `${nitroDefault}/server/index.mjs`;
  const dest = cfg.appOutput;
  const destEntry = `${dest}/server/index.mjs`;

  log.info(`Waiting for ${srcEntry}...`);
  for (;;) {
    if (isFile(srcEntry)) break;
    await Bun.sleep(2000);
  }

  if (nitroDefault !== dest) {
    log.info(`Publishing ${nitroDefault}/ → ${dest}/`);
    await runCmd(["mkdir", "-p", dest], "/");
    await runCmd(
      ["rsync", "-a", "--delete", `${nitroDefault}/`, `${dest}/`],
      "/",
    );
  }

  if (!isDirectory(dest) || !isFile(destEntry)) {
    throw new Error(`Build finished but ${destEntry} is missing`);
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

  await publishBuildOutput(cfg, repoRoot, log);
}
