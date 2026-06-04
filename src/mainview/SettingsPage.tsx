import type { AnalysisSettings, AnalysisAspect } from "../shared/types";

const ASPECTS: { id: AnalysisAspect; label: string; description: string }[] = [
  { id: "key",     label: "Key",     description: "Musical key detection (Essentia DSP)" },
  { id: "bpm",     label: "BPM",     description: "Tempo detection (Essentia DSP)" },
  { id: "bitrate", label: "Bitrate", description: "True average bitrate via ffprobe packet counting (opt-in)" },
];

interface SettingsPageProps {
  settings: AnalysisSettings;
  onChange: (patch: Partial<AnalysisSettings>) => void;
}

export function SettingsPage({ settings, onChange }: SettingsPageProps) {
  function toggleAspect(aspect: AnalysisAspect) {
    const current = settings.aspects;
    const next = current.includes(aspect)
      ? current.filter((a) => a !== aspect)
      : [...current, aspect];
    onChange({ aspects: next });
  }

  return (
    <div className="max-w-lg p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Analysis Settings</h2>
        <p className="text-sm text-muted-foreground">Configure the audio analysis engine.</p>
      </div>

      {/* Parallelism */}
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

      {/* Aspect checkboxes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis aspects</label>
        <p className="text-xs text-muted-foreground mb-2">
          Which features to compute for each track.
        </p>
        <div className="space-y-2">
          {ASPECTS.map(({ id, label, description }) => {
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
