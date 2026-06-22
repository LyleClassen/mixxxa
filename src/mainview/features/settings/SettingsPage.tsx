import { useEffect, useState, useCallback } from "react";
import type {
  AnalysisSettings,
  AnalysisAspect,
  AnalysisEngine,
  KeyNotation,
  BackupInfo,
  SyncErrorKind,
} from "../../../shared/types";
import { electroview } from "../../rpc";

const KEY_NOTATIONS: { id: KeyNotation; label: string; example: string }[] = [
  { id: "camelot", label: "Camelot", example: "8B / 5A" },
  { id: "musical", label: "Musical", example: "C / Cm" },
  { id: "openkey", label: "Open Key", example: "1d / 6m" },
];

interface AspectDef {
  id: AnalysisAspect;
  label: string;
  description: string;
  engines: AnalysisEngine[];
}

const ASPECTS: AspectDef[] = [
  { id: "key",         label: "Key",           engines: ["essentia", "orbit"], description: "Musical key detection" },
  { id: "bpm",         label: "BPM",           engines: ["essentia", "orbit"], description: "Tempo detection" },
  { id: "bitrate",     label: "Bitrate",       engines: ["essentia", "orbit"], description: "True average bitrate via ffprobe packet counting (opt-in)" },
  { id: "energy",      label: "Energy",        engines: ["orbit"],             description: "Spectral energy level (0–1)" },
  { id: "loudness",    label: "Loudness",      engines: ["orbit"],             description: "Integrated loudness in dBFS" },
  { id: "dynamics",    label: "Dynamic Range", engines: ["orbit"],             description: "Peak-to-floor dynamic range in dB" },
  { id: "danceability",label: "Danceability",  engines: ["orbit"],             description: "BPM + energy danceability score (0–1)" },
];

interface SettingsPageProps {
  settings: AnalysisSettings;
  onChange: (patch: Partial<AnalysisSettings>) => void;
  // Re-import the Rekordbox library (used after restoring a backup).
  onResync: () => Promise<void>;
}

export function SettingsPage({ settings, onChange, onResync }: SettingsPageProps) {
  const engine = settings.engine ?? "essentia";
  const keyNotation = settings.keyNotation ?? "camelot";

  function toggleAspect(aspect: AnalysisAspect) {
    const current = settings.aspects;
    const next = current.includes(aspect)
      ? current.filter((a) => a !== aspect)
      : [...current, aspect];
    onChange({ aspects: next });
  }

  function setEngine(next: AnalysisEngine) {
    onChange({ engine: next });
  }

  const visibleAspects = ASPECTS.filter((a) => a.engines.includes(engine));

  return (
    <div className="max-w-lg p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Analysis Settings</h2>
        <p className="text-sm text-muted-foreground">Configure the audio analysis engine.</p>
      </div>

      {/* Engine selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis engine</label>
        <p className="text-xs text-muted-foreground mb-2">
          Essentia runs in-process via WASM. ORBIT uses a Python/librosa sidecar for energy, loudness, and danceability.
        </p>
        <div className="space-y-2">
          {(["essentia", "orbit"] as AnalysisEngine[]).map((e) => {
            const selected = engine === e;
            const label = e === "essentia" ? "Essentia (built-in)" : "ORBIT (Python/librosa)";
            return (
              <button
                key={e}
                onClick={() => setEngine(e)}
                className="w-full flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/30 transition-colors text-left"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selected ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </span>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Key notation */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Key notation</label>
        <p className="text-xs text-muted-foreground mb-2">
          How musical keys are displayed in the track list and player. Keys are always stored as Camelot.
        </p>
        <div className="space-y-2">
          {KEY_NOTATIONS.map(({ id, label, example }) => {
            const selected = keyNotation === id;
            return (
              <button
                key={id}
                onClick={() => onChange({ keyNotation: id })}
                className="w-full flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/30 transition-colors text-left"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selected ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </span>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{example}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parallelism (essentia only — ORBIT is single-process) */}
      {engine === "essentia" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Worker parallelism</label>
          <p className="text-xs text-muted-foreground mb-2">
            Number of simultaneous analysis workers. Higher = faster but uses more CPU/RAM.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange({ parallelism: Math.max(1, settings.parallelism - 1) })}
              className="w-8 h-8 rounded-md border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-bold transition-colors"
              disabled={settings.parallelism <= 1}
            >
              −
            </button>
            <span className="w-6 text-center font-mono font-bold">{settings.parallelism}</span>
            <button
              onClick={() => onChange({ parallelism: Math.min(8, settings.parallelism + 1) })}
              className="w-8 h-8 rounded-md border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-bold transition-colors"
              disabled={settings.parallelism >= 8}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Log file retention */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Log file retention</label>
        <p className="text-xs text-muted-foreground mb-2">
          How many session log files to keep in the <code>logs/</code> folder (oldest are pruned on startup).
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange({ maxLogFiles: Math.max(1, settings.maxLogFiles - 1) })}
            className="w-8 h-8 rounded-md border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-bold transition-colors"
            disabled={settings.maxLogFiles <= 1}
          >
            −
          </button>
          <span className="w-6 text-center font-mono font-bold">{settings.maxLogFiles}</span>
          <button
            onClick={() => onChange({ maxLogFiles: Math.min(50, settings.maxLogFiles + 1) })}
            className="w-8 h-8 rounded-md border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-bold transition-colors"
            disabled={settings.maxLogFiles >= 50}
          >
            +
          </button>
        </div>
      </div>

      {/* Aspect checkboxes filtered by engine */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis aspects</label>
        <p className="text-xs text-muted-foreground mb-2">
          Which features to compute for each track.
        </p>
        <div className="space-y-2">
          {visibleAspects.map(({ id, label, description }) => {
            const checked = settings.aspects.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleAspect(id)}
                className="w-full flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/30 transition-colors text-left"
              >
                <span
                  className={`mt-0.5 w-4 h-4 border rounded-sm flex items-center justify-center shrink-0 ${
                    checked ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-primary-foreground">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <RekordboxBackupsSection onResync={onResync} />
    </div>
  );
}

// ── Rekordbox Backups / Restore ───────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

const ORIGIN_LABELS: Record<BackupInfo["origin"], string> = {
  prewrite: "before write",
  prerestore: "before restore",
  manual: "manual",
};

function restoreErrorMessage(kind: SyncErrorKind | null): string {
  if (kind === "locked") return "Rekordbox is running. Close it and try again.";
  if (kind === "not-found") return "Rekordbox master.db not found.";
  return "Restore failed. Please try again.";
}

function RekordboxBackupsSection({ onResync }: { onResync: () => Promise<void> }) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [maxBackups, setMaxBackups] = useState(10);
  const [confirmFile, setConfirmFile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const loadBackups = useCallback(() => {
    electroview.rpc!.request.listRekordboxBackups().then(setBackups).catch(() => {});
  }, []);

  useEffect(() => {
    loadBackups();
    electroview.rpc!.request.getRekordboxSettings()
      .then((s) => setMaxBackups(s.maxBackups))
      .catch(() => {});
  }, [loadBackups]);

  function changeMax(next: number) {
    const clamped = Math.max(1, Math.min(100, next));
    setMaxBackups(clamped);
    electroview.rpc!.request.setRekordboxSettings({ maxBackups: clamped })
      .then((s) => setMaxBackups(s.maxBackups))
      .catch(() => {});
  }

  async function handleRestore(filename: string) {
    setRestoring(true);
    setMessage(null);
    try {
      await electroview.rpc!.request.restoreRekordboxBackup({ filename });
      // Re-import the just-restored library so the app no longer shows stale data.
      await onResync();
      setMessage({ kind: "success", text: "Backup restored and library re-synced. A safety backup of the previous state was created." });
      loadBackups();
    } catch (err: unknown) {
      const kind = (err as { syncErrorKind?: SyncErrorKind }).syncErrorKind ?? null;
      setMessage({ kind: "error", text: restoreErrorMessage(kind) });
    } finally {
      setRestoring(false);
      setConfirmFile(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Rekordbox Backups</h2>
        <p className="text-sm text-muted-foreground">
          Timestamped copies of <code>master.db</code> created before each write-back. Restore one to
          roll back; restoring first backs up the current state.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Max backups to keep</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeMax(maxBackups - 1)}
            className="w-8 h-8 rounded-md border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-bold transition-colors"
            disabled={maxBackups <= 1}
          >
            −
          </button>
          <span className="w-8 text-center font-mono font-bold">{maxBackups}</span>
          <button
            onClick={() => changeMax(maxBackups + 1)}
            className="w-8 h-8 rounded-md border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-bold transition-colors"
            disabled={maxBackups >= 100}
          >
            +
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-xs ${message.kind === "success" ? "text-primary" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No backups yet.</p>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div key={b.filename} className="flex items-center justify-between gap-2 p-3 rounded-md border border-border">
              <div className="min-w-0">
                <div className="text-sm font-medium">{new Date(b.createdAt).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {formatSize(b.sizeBytes)} · {ORIGIN_LABELS[b.origin]}
                </div>
              </div>
              {confirmFile === b.filename ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(b.filename)}
                    disabled={restoring}
                    className="text-xs font-bold px-2 py-1 rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {restoring ? "Restoring…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmFile(null)}
                    disabled={restoring}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setConfirmFile(b.filename); setMessage(null); }}
                  className="text-xs font-bold px-3 py-1 rounded-md border border-border hover:bg-muted/50 transition-colors shrink-0"
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
