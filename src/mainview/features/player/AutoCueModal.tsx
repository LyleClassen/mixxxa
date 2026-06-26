import { useEffect, useState } from "react";
import type { AutoCueResult, AutoCueSettings, CueMarker, Track } from "../../../shared/types";
import { electroview } from "../../rpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type Phase = "editing" | "running" | "done" | "error";

interface AutoCueModalProps {
  track: Track;
  // Latest progress for this track (App filters autoCueProgress by trackId).
  progress: { step: string; pct: number } | null;
  onClose: () => void;
  // Push the resulting cue list back into App + player when the modal track is
  // the one currently loaded.
  onCuesApplied: (trackId: string, cues: CueMarker[]) => void;
}

const STEP_LABELS: Record<string, string> = {
  candidates: "Finding drop candidates…",
  features: "Extracting features…",
  classify: "Classifying drops…",
  bpm: "Detecting BPM…",
};

export function AutoCueModal({ track, progress, onClose, onCuesApplied }: AutoCueModalProps) {
  const [phase, setPhase] = useState<Phase>("editing");
  const [settings, setSettings] = useState<AutoCueSettings | null>(null);
  const [result, setResult] = useState<AutoCueResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    electroview.rpc!.request.getAutoCueSettings()
      .then(setSettings)
      .catch(() => setSettings({
        rules: [{ bpmMin: 160, bpmMax: 190, beatsBefore: 64 }],
        fallbackBeatsBefore: 32,
        confidenceThreshold: 0.5,
        addStartCue: true,
        addEndCue: true,
        beatsBeforeEnd: 32,
      }));
  }, []);

  function updateRule(i: number, patch: Partial<AutoCueSettings["rules"][number]>) {
    setSettings((s) => s && { ...s, rules: s.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  }

  function addRule() {
    setSettings((s) => s && { ...s, rules: [...s.rules, { bpmMin: 120, bpmMax: 130, beatsBefore: 32 }] });
  }

  function removeRule(i: number) {
    setSettings((s) => s && { ...s, rules: s.rules.filter((_, j) => j !== i) });
  }

  async function handleApply() {
    if (!settings) return;
    setPhase("running");
    try {
      await electroview.rpc!.request.setAutoCueSettings(settings);
      const res = await electroview.rpc!.request.autoCueTrack({ trackId: track.id });
      setResult(res);
      setPhase("done");
      onCuesApplied(track.id, res.cues);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function handleUndo() {
    try {
      const cues = await electroview.rpc!.request.undoAutoCue({ trackId: track.id });
      onCuesApplied(track.id, cues);
      onClose();
    } catch {
      // leave the modal open if undo fails
    }
  }

  const trackBpm = track.analyzedBpm ?? track.bpm;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Auto cue points</DialogTitle>
          <DialogDescription>
            {track.artist ? `${track.artist} – ` : ""}{track.title || "Unknown"}
          </DialogDescription>
        </DialogHeader>

        {phase === "editing" && settings && (
          <div className="flex flex-col gap-4 min-w-0">
            <div className="text-xs text-muted-foreground">
              {trackBpm != null
                ? <>Track BPM: <span className="text-foreground font-medium">{Math.round(trackBpm)}</span></>
                : "BPM will be detected automatically"}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lead-in rules</span>
                <button onClick={addRule} className="text-muted-foreground hover:text-foreground" title="Add rule">
                  <Plus size={14} />
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-center text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>BPM min</span><span>BPM max</span><span>Beats before</span><span />
              </div>
              {settings.rules.map((rule, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-center">
                  <NumInput value={rule.bpmMin} onChange={(v) => updateRule(i, { bpmMin: v })} />
                  <NumInput value={rule.bpmMax} onChange={(v) => updateRule(i, { bpmMax: v })} />
                  <NumInput value={rule.beatsBefore} onChange={(v) => updateRule(i, { beatsBefore: v })} />
                  <button onClick={() => removeRule(i)} className="text-muted-foreground hover:text-destructive p-1" title="Remove rule">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Fallback beats before</span>
              <NumInput
                value={settings.fallbackBeatsBefore}
                onChange={(v) => setSettings((s) => s && { ...s, fallbackBeatsBefore: v })}
                className="w-20"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between">
                <span className="text-muted-foreground">Confidence threshold</span>
                <span className="font-mono text-xs">{settings.confidenceThreshold.toFixed(2)}</span>
              </span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={settings.confidenceThreshold}
                onChange={(e) => setSettings((s) => s && { ...s, confidenceThreshold: parseFloat(e.target.value) })}
                className="accent-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Add cue at start</span>
              <input
                type="checkbox"
                checked={settings.addStartCue}
                onChange={(e) => setSettings((s) => s && { ...s, addStartCue: e.target.checked })}
                className="accent-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Add cue before end</span>
              <input
                type="checkbox"
                checked={settings.addEndCue}
                onChange={(e) => setSettings((s) => s && { ...s, addEndCue: e.target.checked })}
                className="accent-primary cursor-pointer"
              />
            </label>

            {settings.addEndCue && (
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Beats before end</span>
                <NumInput
                  value={settings.beatsBeforeEnd}
                  onChange={(v) => setSettings((s) => s && { ...s, beatsBeforeEnd: v })}
                  className="w-20"
                />
              </label>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleApply}>Apply</Button>
            </DialogFooter>
          </div>
        )}

        {phase === "running" && (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              {progress ? (STEP_LABELS[progress.step] ?? progress.step) : "Starting…"}
            </p>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((progress?.pct ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {phase === "done" && result && (() => {
          const cuesSet = result.cues.filter((c) => c.kind >= 1 && c.kind <= 8).length;
          return (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm">
              <span className="font-medium">{result.dropsDetected}</span> drop{result.dropsDetected === 1 ? "" : "s"} detected,{" "}
              <span className="font-medium">{cuesSet}</span> cue{cuesSet === 1 ? "" : "s"} set.
            </p>
            {result.computedBpm != null && (
              <p className="text-xs text-muted-foreground">Detected BPM: {Math.round(result.computedBpm)}</p>
            )}
            {result.cues.length > 0 && (
              <ul className="text-xs text-muted-foreground flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {[...result.cues]
                  .filter((c) => c.kind >= 1 && c.kind <= 8)
                  .sort((a, b) => a.kind - b.kind)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="inline-block w-4 font-bold text-foreground">{String.fromCharCode(64 + c.kind)}</span>
                      <span>{c.comment ?? "—"}</span>
                    </li>
                  ))}
              </ul>
            )}
            <DialogFooter>
              {result.undoAvailable && (
                <Button variant="outline" size="sm" onClick={handleUndo}>Undo</Button>
              )}
              <Button size="sm" onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
          );
        })()}

        {phase === "error" && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-destructive">{errorMsg || "Auto cue failed."}</p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPhase("editing")}>Back</Button>
              <Button size="sm" onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NumInput({
  value, onChange, className,
}: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v)) onChange(v);
      }}
      className={`min-w-0 bg-muted/50 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${className ?? ""}`}
    />
  );
}
