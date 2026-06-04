import { appendFileSync, writeFileSync } from "node:fs";

const LOG_PATH = `${process.env.USERPROFILE}\\Desktop\\mixxxa-bun.log`;

// Truncate log file on process start so each run is clean
try { writeFileSync(LOG_PATH, `=== mixxxa bun log started ${new Date().toISOString()} ===\n`); } catch { /* ignore */ }

export function bunLog(tag: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${tag}] ${msg}\n`;
  try { appendFileSync(LOG_PATH, line); } catch { /* ignore */ }
}
