import {
  mkdirSync,
  copyFileSync,
  existsSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import type { BackupInfo, BackupOrigin } from "../shared/types";
import { makeSyncError } from "./rpc/rekordboxShared";

// Rekordbox keeps `master.db` plus these SQLite sidecars. A consistent backup
// must capture them alongside the main file.
const SIDECARS = ["-wal", "-shm"] as const;

const ORIGINS: ReadonlySet<BackupOrigin> = new Set(["prewrite", "prerestore", "manual"]);

// e.g. master-2026-06-22T14-30-05-123Z-prewrite.db
const BACKUP_NAME_RE = /^master-(.+)-(prewrite|prerestore|manual)\.db$/;

/** Resolve (creating if needed) the app-managed backups directory. */
export function getBackupsDir(dataDir: string): string {
  const dir = join(dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A sortable, filesystem-safe UTC timestamp: 2026-06-22T14-30-05-123Z. */
function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Copy `master.db` (and any `-wal`/`-shm` sidecars) into `backupsDir` under a
 * sortable-timestamp + origin filename. Returns the backup's base filename.
 * Throws a `backup-failed` typed error if any copy fails.
 */
export function createBackup(
  masterDbPath: string,
  backupsDir: string,
  origin: BackupOrigin,
): string {
  const filename = `master-${timestamp()}-${origin}.db`;
  try {
    mkdirSync(backupsDir, { recursive: true });
    copyFileSync(masterDbPath, join(backupsDir, filename));
    for (const sidecar of SIDECARS) {
      const src = masterDbPath + sidecar;
      if (existsSync(src)) {
        copyFileSync(src, join(backupsDir, filename + sidecar));
      }
    }
  } catch (err) {
    throw makeSyncError(
      "backup-failed",
      `Could not create a backup of master.db: ${(err as Error).message}`,
    );
  }
  return filename;
}

/** List backups (base files only) newest-first, with size/mtime/origin. */
export function listBackups(backupsDir: string): BackupInfo[] {
  if (!existsSync(backupsDir)) return [];
  const infos: BackupInfo[] = [];
  for (const name of readdirSync(backupsDir)) {
    const match = BACKUP_NAME_RE.exec(name);
    if (!match) continue; // skip sidecars and unrelated files
    const origin = match[2] as BackupOrigin;
    if (!ORIGINS.has(origin)) continue;
    const stat = statSync(join(backupsDir, name));
    infos.push({
      filename: name,
      createdAt: stat.mtimeMs,
      sizeBytes: stat.size,
      origin,
    });
  }
  infos.sort((a, b) => b.createdAt - a.createdAt);
  return infos;
}

/**
 * Restore a backup over the live `master.db`. Copies the backup's main file and
 * any sidecars into place, and removes stale live sidecars not present in the
 * backup so the restored snapshot is consistent.
 */
export function restoreBackup(
  backupsDir: string,
  filename: string,
  masterDbPath: string,
): void {
  const src = join(backupsDir, filename);
  if (!existsSync(src)) {
    throw makeSyncError("not-found", `Backup ${filename} no longer exists.`);
  }
  try {
    copyFileSync(src, masterDbPath);
    for (const sidecar of SIDECARS) {
      const sidecarSrc = src + sidecar;
      const liveSidecar = masterDbPath + sidecar;
      if (existsSync(sidecarSrc)) {
        copyFileSync(sidecarSrc, liveSidecar);
      } else if (existsSync(liveSidecar)) {
        // Stale live sidecar not part of this snapshot — drop it.
        rmSync(liveSidecar);
      }
    }
  } catch (err) {
    throw makeSyncError(
      "write-failed",
      `Could not restore backup ${filename}: ${(err as Error).message}`,
    );
  }
}

/** Delete the oldest backups (and their sidecars) beyond `maxBackups`. */
export function pruneBackups(backupsDir: string, maxBackups: number): void {
  const backups = listBackups(backupsDir); // newest-first
  const excess = backups.slice(Math.max(0, maxBackups));
  for (const backup of excess) {
    const base = join(backupsDir, backup.filename);
    try {
      rmSync(base, { force: true });
      for (const sidecar of SIDECARS) {
        rmSync(base + sidecar, { force: true });
      }
    } catch {
      // Best-effort pruning — a failure to delete one old backup is non-fatal.
    }
  }
}
