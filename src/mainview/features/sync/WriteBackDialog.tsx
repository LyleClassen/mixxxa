import { useEffect, useState, useCallback, type ReactNode } from "react";
import type {
  RekordboxDiff,
  WriteBackAspects,
  WriteBackSummary,
  WriteBackProgress,
  SyncErrorKind,
} from "../../../shared/types";
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

type Phase = "loading" | "review" | "nothing" | "writing" | "done" | "error";

interface WriteBackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called after a successful write so the app can re-import Rekordbox and
  // realign both databases. Fire-and-forget — the resync runs behind the dialog.
  onWritten?: () => void;
}

function errorMessage(kind: SyncErrorKind | null): string {
  switch (kind) {
    case "locked":
      return "Rekordbox is running. Close Rekordbox and try again.";
    case "not-found":
      return "Rekordbox master.db not found. Install and open Rekordbox first.";
    case "write-failed":
      return "Writing to Rekordbox failed partway through. A pre-write backup was created — restore it from Settings → Rekordbox Backups.";
    case "backup-failed":
      return "Could not create a safety backup before writing, so nothing was written. Free up disk space and try again.";
    case "stale-diff":
      return "Rekordbox changed since this diff was computed. Re-run Sync to Rekordbox to review the latest changes.";
    default:
      return "Sync to Rekordbox failed. Please try again.";
  }
}

export function WriteBackDialog({ open, onOpenChange, onWritten }: WriteBackDialogProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [diff, setDiff] = useState<RekordboxDiff | null>(null);
  const [errorKind, setErrorKind] = useState<SyncErrorKind | null>(null);
  const [aspects, setAspects] = useState<WriteBackAspects>({ ordering: true, bpm: true, key: true, metadata: true });
  const [progress, setProgress] = useState<WriteBackProgress | null>(null);
  const [summary, setSummary] = useState<WriteBackSummary | null>(null);

  const bpmChanges = diff?.trackChanges.filter((c) => c.field === "bpm") ?? [];
  const keyChanges = diff?.trackChanges.filter((c) => c.field === "key") ?? [];
  const metadataChanges = diff?.trackChanges.filter(
    (c) => c.field === "artist" || c.field === "title" || c.field === "album",
  ) ?? [];
  const hasOrdering = (diff?.playlists.length ?? 0) > 0;
  const hasBpm = bpmChanges.length > 0;
  const hasKey = keyChanges.length > 0;
  const hasMetadata = metadataChanges.length > 0;

  // Compute the diff each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    setDiff(null);
    setErrorKind(null);
    setProgress(null);
    setSummary(null);
    setAspects({ ordering: true, bpm: true, key: true, metadata: true });

    electroview.rpc!.request.diffRekordbox()
      .then((result) => {
        if (cancelled) return;
        setDiff(result);
        const empty = result.playlists.length === 0 && result.trackChanges.length === 0;
        setPhase(empty ? "nothing" : "review");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorKind((err as { syncErrorKind?: SyncErrorKind }).syncErrorKind ?? null);
        setPhase("error");
      });

    return () => { cancelled = true; };
  }, [open]);

  // Subscribe to write-back progress while open.
  useEffect(() => {
    if (!open || !electroview.rpc) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyRpc = electroview.rpc as any;
    const handler = (msg: WriteBackProgress) => setProgress(msg);
    anyRpc.addMessageListener("writeBackProgress", handler);
    return () => anyRpc.removeMessageListener("writeBackProgress", handler);
  }, [open]);

  const handleConfirm = useCallback(async () => {
    if (!diff) return;
    setPhase("writing");
    setProgress(null);
    try {
      const result = await electroview.rpc!.request.writeBackToRekordbox({
        confirmedDiff: diff,
        selectedAspects: aspects,
      });
      setSummary(result);
      setPhase("done");
      // Realign the local library with Rekordbox now that the write landed.
      onWritten?.();
    } catch (err: unknown) {
      setErrorKind((err as { syncErrorKind?: SyncErrorKind }).syncErrorKind ?? null);
      setPhase("error");
    }
  }, [diff, aspects, onWritten]);

  function toggle(aspect: keyof WriteBackAspects) {
    setAspects((prev) => ({ ...prev, [aspect]: !prev[aspect] }));
  }

  const nothingSelected =
    (!hasOrdering || !aspects.ordering) &&
    (!hasBpm || !aspects.bpm) &&
    (!hasKey || !aspects.key) &&
    (!hasMetadata || !aspects.metadata);

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Sync to Rekordbox</DialogTitle>
          <DialogDescription>
            Review the changes below before they are written back to your Rekordbox library.
          </DialogDescription>
        </DialogHeader>

        {phase === "loading" && (
          <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
            Computing changes…
          </div>
        )}

        {phase === "nothing" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nothing to sync — your Rekordbox library already matches the local changes.
          </div>
        )}

        {phase === "error" && (
          <div className="py-6 text-sm text-destructive">{errorMessage(errorKind)}</div>
        )}

        {phase === "review" && diff && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {hasOrdering && (
              <AspectSection
                label="Playlist ordering"
                count={diff.playlists.length}
                checked={aspects.ordering}
                onToggle={() => toggle("ordering")}
              >
                {diff.playlists.map((pl) => (
                  <div key={pl.playlistId} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">{pl.name}</span>
                    <span className="shrink-0 ml-2">{pl.changedCount} moved</span>
                  </div>
                ))}
              </AspectSection>
            )}

            {hasBpm && (
              <AspectSection
                label="BPM"
                count={bpmChanges.length}
                checked={aspects.bpm}
                onToggle={() => toggle("bpm")}
              >
                {bpmChanges.map((c) => (
                  <ChangeRow key={c.trackId} title={c.title} oldValue={c.oldValue} newValue={c.newValue} />
                ))}
              </AspectSection>
            )}

            {hasKey && (
              <AspectSection
                label="Key"
                count={keyChanges.length}
                checked={aspects.key}
                onToggle={() => toggle("key")}
              >
                {keyChanges.map((c) => (
                  <ChangeRow key={c.trackId} title={c.title} oldValue={c.oldValue} newValue={c.newValue} />
                ))}
              </AspectSection>
            )}

            {hasMetadata && (
              <AspectSection
                label="Metadata (artist / title / album)"
                count={metadataChanges.length}
                checked={aspects.metadata}
                onToggle={() => toggle("metadata")}
              >
                {metadataChanges.map((c) => (
                  <ChangeRow key={`${c.trackId}-${c.field}`} title={`${c.title} · ${c.field}`} oldValue={c.oldValue} newValue={c.newValue} />
                ))}
              </AspectSection>
            )}
          </div>
        )}

        {phase === "writing" && (
          <div className="py-6 space-y-3">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {progress
                ? `${progress.current}/${progress.total} — ${progress.label}`
                : "Backing up and writing…"}
            </div>
          </div>
        )}

        {phase === "done" && summary && (
          <div className="py-6 text-sm space-y-1">
            <p className="font-medium">Write-back complete.</p>
            <ul className="text-muted-foreground text-xs list-disc pl-5">
              <li>{summary.playlistsReordered} playlist(s) reordered</li>
              <li>{summary.bpmUpdated} BPM value(s) updated</li>
              <li>{summary.keysUpdated} key(s) updated</li>
              <li>{summary.metadataUpdated} metadata field(s) updated</li>
            </ul>
          </div>
        )}

        <DialogFooter>
          {phase === "review" && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={nothingSelected}>
                Write to Rekordbox
              </Button>
            </>
          )}
          {(phase === "nothing" || phase === "done" || phase === "error") && (
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AspectSection({
  label,
  count,
  checked,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span
          className={`w-4 h-4 border rounded-sm flex items-center justify-center shrink-0 ${
            checked ? "bg-primary border-primary" : "border-border"
          }`}
        >
          {checked && (
            <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-primary-foreground">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="text-sm font-medium flex-1">{label}</span>
        <span className="text-xs text-muted-foreground">{count} change(s)</span>
      </button>
      <div className="px-3 pb-3 space-y-1">{children}</div>
    </div>
  );
}

function ChangeRow({ title, oldValue, newValue }: { title: string; oldValue: string; newValue: string }) {
  return (
    <div className="flex justify-between text-xs text-muted-foreground gap-2">
      <span className="truncate">{title}</span>
      <span className="shrink-0 font-mono">
        {oldValue} <span className="text-foreground">→ {newValue}</span>
      </span>
    </div>
  );
}
