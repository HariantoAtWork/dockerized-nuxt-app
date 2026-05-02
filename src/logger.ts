const MAX_LINES = 400;

export function createRingLog(verbose: boolean) {
  const lines: string[] = [];

  function push(level: string, msg: string) {
    const line = `${new Date().toISOString()} [${level}] ${msg}`;
    lines.push(line);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    if (level === "ERROR") console.error(line);
    else if (level !== "INFO" || verbose) console.log(line);
  }

  return {
    info: (msg: string) => push("INFO", msg),
    warn: (msg: string) => push("WARN", msg),
    error: (msg: string) => push("ERROR", msg),
    tail: (n = 200) => lines.slice(-n),
  };
}

export type RingLog = ReturnType<typeof createRingLog>;
