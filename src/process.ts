/** Run a command and capture stdout/stderr; throws if exit code !== 0 when throwOnError is true */
export async function runCmd(
  cmd: string[],
  cwd: string,
  opts?: { env?: Record<string, string>; throwOnError?: boolean },
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...opts?.env },
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  const throwOnError = opts?.throwOnError !== false;
  if (throwOnError && code !== 0) {
    throw new Error(
      `Command failed (${code}): ${cmd.join(" ")}\n${stderr || stdout}`,
    );
  }
  return { code, stdout, stderr };
}
