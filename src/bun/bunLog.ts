import { appendFileSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let logPath: string | null = null;

export function initBunLog(logsDir: string, maxFiles: number): void {
  try {
    console.log("Logs directory:", logsDir);
    mkdirSync(logsDir, { recursive: true });
    pruneOldLogs(logsDir, maxFiles);
    const ts = new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
    logPath = join(logsDir, `mixxxa-${ts}.log`);
    writeFileSync(logPath, `=== mixxxa session started ${new Date().toISOString()} ===\n`);
  } catch (error) { console.error("Error initializing Bun log:", error); }
}

function pruneOldLogs(logsDir: string, maxFiles: number): void {
  try {
    const files = readdirSync(logsDir)
      .filter(f => /^mixxxa-.*\.log$/.test(f))
      .sort()
      .map(f => join(logsDir, f));
    // Delete oldest to keep room for the new file we're about to create
    const excess = files.length - (maxFiles - 1);
    for (let i = 0; i < excess; i++) {
      try { unlinkSync(files[i]!); } catch { }
    }
  } catch { }
}

export function bunLog(tag: string, msg: string): void {
  if (!logPath) return;
  const line = `[${new Date().toISOString()}] [${tag}] ${msg}\n`;
  try { appendFileSync(logPath, line); } catch { }
}
