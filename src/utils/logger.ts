/* Minimal structured logger — swap for pino/winston later without touching callers. */
type Level = "info" | "warn" | "error";

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const line = { level, time: new Date().toISOString(), message, ...(meta || {}) };
  const out = process.env.NODE_ENV === "production" ? JSON.stringify(line) : `[${level}] ${message}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  info: (m: string, meta?: Record<string, unknown>) => log("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log("error", m, meta),
};
