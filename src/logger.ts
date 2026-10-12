const MAX_LINES = 400;

export function createLineRing(maxLines = MAX_LINES) {
  const lines: string[] = [];

  return {
    push(line: string) {
      lines.push(line);
      if (lines.length > maxLines) lines.splice(0, lines.length - maxLines);
    },
    tail(n = 200) {
      return lines.slice(-n);
    },
  };
}

export type LineRing = ReturnType<typeof createLineRing>;

export function createRingLog(verbose: boolean) {
  const ring = createLineRing();

  function push(level: string, msg: string) {
    const line = `${new Date().toISOString()} [${level}] ${msg}`;
    ring.push(line);
    if (level === "ERROR") console.error(line);
    else if (level !== "INFO" || verbose) console.log(line);
  }

  return {
    info: (msg: string) => push("INFO", msg),
    warn: (msg: string) => push("WARN", msg),
    error: (msg: string) => push("ERROR", msg),
    tail: (n = 200) => ring.tail(n),
  };
}

export type RingLog = ReturnType<typeof createRingLog>;
