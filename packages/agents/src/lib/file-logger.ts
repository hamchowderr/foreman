import { createWriteStream, type WriteStream } from "node:fs";
import { join } from "node:path";

let logStream: WriteStream | undefined;

function getStream(): WriteStream {
  if (!logStream) {
    const logPath = join(process.cwd(), "server.log");
    logStream = createWriteStream(logPath, { flags: "a" });
  }
  return logStream;
}

function formatLine(level: string, args: unknown[]): string {
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  return `${ts} [${level}] ${msg}\n`;
}

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

export function enableFileLogging() {
  console.log = (...args: unknown[]) => {
    _log(...args);
    try {
      getStream().write(formatLine("INFO", args));
    } catch {}
  };
  console.warn = (...args: unknown[]) => {
    _warn(...args);
    try {
      getStream().write(formatLine("WARN", args));
    } catch {}
  };
  console.error = (...args: unknown[]) => {
    _error(...args);
    try {
      getStream().write(formatLine("ERROR", args));
    } catch {}
  };
  console.log("[file-logger] Logging to server.log");
}
