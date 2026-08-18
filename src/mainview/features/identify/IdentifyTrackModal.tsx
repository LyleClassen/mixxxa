import { useEffect, useState } from "react";
import type { IdentifyCandidate, IdentifyProgress, Track } from "../../../shared/types";
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

type Phase = "running" | "results" | "no-match" | "applied" | "error";

interface IdentifyTrackModalProps {
  track: Track;
  // Latest identify progress for this track (App filters identifyProgress by trackId).
  progress: IdentifyProgress | null;
  onClose: () => void;
  onApplied: (track: Track) => void;
}

const PHASE_LABELS: Record<IdentifyProgress["phase"], string> = {
  fingerprint: "Computing fingerprint…",
  duration: "Reading track duration…",
  lookup: "Looking up on AcoustID…",
};

export function IdentifyTrackModal({ track, progress, onClose, onApplied }: IdentifyTrackModalProps) {
  const [phase, setPhase] = useState<Phase>("running");
  const [candidates, setCandidates] = useState<IdentifyCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [applying, setApplying] = useState(false);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("running");
    setCandidates([]);
    setSelectedIndex(0);

    electroview.rpc!.request.identifyTrack({ trackId: track.id })
      .then((result) => {
        if (cancelled) return;
        setCandidates(result.candidates);
        setPhase(result.candidates.length > 0 ? "results" : "no-match");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, retryCount]);

  async function handleApply() {
    const candidate = candidates[selectedIndex];
    if (!candidate) return;
    setApplying(true);
    try {
      const updated = await electroview.rpc!.request.applyIdentifiedMetadata({ trackId: track.id, candidate });
      onApplied(updated);
      setPhase("applied");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    } finally {
      setApplying(false);
    }
  }

  const selected = candidates[selectedIndex] ?? null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Identify track…</DialogTitle>
          <DialogDescription>
            {track.artist ? `${track.artist} – ` : ""}{track.title || "Unknown"}
          </DialogDescription>
        </DialogHeader>

        {phase === "running" && (
          <div className="flex flex-col gap-3 py-6">
            <p className="text-sm text-muted-foreground">
              {progress ? PHASE_LABELS[progress.phase] : "Starting…"}
            </p>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {phase === "no-match" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No confident match found.
          </div>
        )}

        {phase === "results" && (
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {candidates.map((c, i) => (
                <button
                  key={`${c.acoustidTrackId}-${c.recordingMbid ?? i}`}
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    i === selectedIndex ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <span className="truncate">
                    {c.artist ? `${c.artist} – ` : ""}{c.title || "Unknown"}
                  </span>
                  <ScoreBadge score={c.score} />
                </button>
              ))}
            </div>

            {selected && (
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-xs items-center">
                <span />
                <span className="text-muted-foreground uppercase tracking-wider">Current</span>
                <span className="text-muted-foreground uppercase tracking-wider">Candidate</span>
                <FieldRow label="Artist" current={track.artist} candidate={selected.artist} />
                <FieldRow label="Title" current={track.title} candidate={selected.title} />
                <FieldRow label="Album" current={track.album} candidate={selected.album} />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleApply} disabled={applying}>
                {applying ? "Applying…" : "Apply"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase === "applied" && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm">Staged — will be written on your next sync to Rekordbox.</p>
            <DialogFooter>
              <Button size="sm" onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-destructive">{errorMsg || "Identification failed."}</p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={() => setRetryCount((n) => n + 1)}>Retry</Button>
            </DialogFooter>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
          Metadata from{" "}
          <a href="https://acoustid.org" target="_blank" rel="noreferrer" className="underline">AcoustID</a>{" "}
          and{" "}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer" className="underline">MusicBrainz</a>{" "}
          (CC BY-SA 3.0)
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const confident = score >= 0.9;
  return (
    <span
      className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
        confident ? "bg-primary/20 text-primary" : "bg-yellow-400/20 text-yellow-300"
      }`}
    >
      {pct}%
    </span>
  );
}

function FieldRow({ label, current, candidate }: { label: string; current: string | null; candidate: string | null }) {
  const differs = (current ?? "") !== (candidate ?? "");
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-muted-foreground">{current || "—"}</span>
      <span className={`truncate ${differs ? "text-foreground font-medium" : "text-muted-foreground"}`}>
        {candidate || "—"}
      </span>
    </>
  );
}
