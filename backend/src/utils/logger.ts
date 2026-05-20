import { getEnv } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (getEnv().NODE_ENV === "production") {
    const line = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
    return;
  }

  const prefix = `[${payload.timestamp}] ${level.toUpperCase()}`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  if (level === "error") {
    process.stderr.write(`${prefix} ${message}${metaStr}\n`);
  } else {
    process.stdout.write(`${prefix} ${message}${metaStr}\n`);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
