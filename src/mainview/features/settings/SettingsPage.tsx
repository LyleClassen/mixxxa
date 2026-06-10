import type { AnalysisSettings, AnalysisAspect, AnalysisEngine } from "../../../shared/types";

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
}

export function SettingsPage({ settings, onChange }: SettingsPageProps) {
  const engine = settings.engine ?? "essentia";

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
    </div>
  );
}
