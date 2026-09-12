import { join } from "node:path";
import { homedir } from "node:os";
import type { SyncErrorKind } from "../../shared/types";

/** Resolve the platform default path to the Rekordbox `master.db`. */
export function getDefaultMasterDbPath(): string {
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appdata, "Pioneer", "rekordbox", "master.db");
  }
  return join(homedir(), "Library", "Pioneer", "rekordbox", "master.db");
}

/** Tag an Error with a typed `syncErrorKind` so the UI can map it to guidance. */
export function makeSyncError(kind: SyncErrorKind, message: string): Error {
  const err = new Error(message);
  (err as Error & { syncErrorKind: SyncErrorKind }).syncErrorKind = kind;
  return err;
}
