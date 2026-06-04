import type { QueueItem, HistoryEntry } from "../shared/types";

// ── Phase labels ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  decoding: "Decoding",
  key: "Key",
  bpm: "BPM",
  bitrate: "Bitrate",
  orbit: "ORBIT",
  persisting: "Saving",
};

function stepProgress(item: QueueItem): number {
  if (!item.phase) return 0;
  const phases: string[] = ["decoding", ...item.aspects, "persisting"];
  const idx = phases.indexOf(item.phase);
  return idx === -1 ? 0 : (idx + item.progress) / phases.length;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "text-muted-foreground",
  running: "text-primary",
  done: "text-green-400",
  failed: "text-destructive",
  canceled: "text-muted-foreground line-through",
};

function msToSec(ms: number | undefined): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Queue item row ────────────────────────────────────────────────────────────

function QueueItemRow({
  item,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: QueueItem;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const isQueued = item.status === "queued";
  const isRunning = item.status === "running";
  // Terminal items can be pruned from the list (but not reordered).
  const isTerminal = item.status === "failed" || item.status === "done" || item.status === "canceled";

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-medium ${STATUS_COLORS[item.status] ?? ""}`}>
            {item.trackArtist ? `${item.trackArtist} – ` : ""}{item.trackTitle || item.trackId}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {isRunning && item.phase && (
            <>
              <span className="text-xs text-primary">{PHASE_LABELS[item.phase] ?? item.phase}</span>
              <div className="flex-1 h-1 bg-muted rounded-full max-w-[80px]">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round(stepProgress(item) * 100)}%` }}
                />
              </div>
            </>
          )}
          {!isRunning && (
            <span className="text-xs text-muted-foreground capitalize">{item.status}</span>
          )}
          {item.error && (
            <span
              className="text-xs text-destructive truncate cursor-help"
              title={item.error}
            >
              {item.error}
            </span>
          )}
        </div>
      </div>

      {(isQueued || isTerminal) && (
        <div className="flex items-center gap-1 shrink-0">
          {isQueued && (
            <>
              <button
                onClick={() => onMoveUp(item.id)}
                className="w-6 h-6 text-xs hover:bg-muted/50 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => onMoveDown(item.id)}
                className="w-6 h-6 text-xs hover:bg-muted/50 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Move down"
              >
                ↓
              </button>
            </>
          )}
          <button
            onClick={() => onRemove(item.id)}
            className="w-6 h-6 text-xs hover:bg-destructive/20 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
            title={isTerminal ? "Prune from list" : "Remove"}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── History view ──────────────────────────────────────────────────────────────

function HistoryView({
  history,
  onPrune,
}: {
  history: HistoryEntry[];
  onPrune: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
        No analysis history yet.
      </div>
    );
  }

  const totalMs = history.reduce((s, e) => s + (e.timeTotalMs ?? 0), 0);
  const avgKeyMs = avg(history.map((e) => e.timeKeyMs));
  const avgBpmMs = avg(history.map((e) => e.timeBpmMs));

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {history.length} runs · total {msToSec(totalMs)}
        </span>
        <button
          onClick={onPrune}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Prune
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Avg Key" value={msToSec(avgKeyMs)} />
        <Stat label="Avg BPM" value={msToSec(avgBpmMs)} />
      </div>

      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {history.slice(0, 50).map((entry) => (
          <div key={entry.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/30">
            <span className={entry.status === "done" ? "text-green-400" : "text-destructive"}>
              {entry.status === "done" ? "✓" : "✗"}
            </span>
            <span className="text-muted-foreground">{new Date(entry.finishedAt).toLocaleTimeString()}</span>
            <span className="flex-1 text-muted-foreground/70 truncate">{entry.aspects.join(", ")}</span>
            <span className="font-mono text-muted-foreground">{msToSec(entry.timeTotalMs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded p-2 text-center">
      <div className="text-lg font-mono font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function avg(vals: (number | undefined)[]): number | undefined {
  const filtered = vals.filter((v): v is number => v != null);
  if (filtered.length === 0) return undefined;
  return Math.round(filtered.reduce((s, v) => s + v, 0) / filtered.length);
}

// ── AnalysisPanel ─────────────────────────────────────────────────────────────

type PanelTab = "queue" | "history";

interface AnalysisPanelProps {
  queue: QueueItem[];
  history: HistoryEntry[];
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onPrune: () => void;
}

export function AnalysisPanel({
  queue,
  history,
  isPaused,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onMoveUp,
  onMoveDown,
  onPrune,
}: AnalysisPanelProps) {
  const [tab, setTab] = useState<PanelTab>("queue");
  const active = queue.filter((i) => i.status === "queued" || i.status === "running");
  const done = queue.filter((i) => i.status === "done" || i.status === "failed" || i.status === "canceled");

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center border-b border-border px-3 shrink-0">
        <button
          onClick={() => setTab("queue")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "queue" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          QUEUE {active.length > 0 && <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px]">{active.length}</span>}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          HISTORY
        </button>
      </div>

      {tab === "queue" && (
        <>
          {/* Controls */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            {isPaused ? (
              <button
                onClick={onResume}
                className="text-xs px-3 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={onPause}
                className="text-xs px-3 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
              >
                Pause
              </button>
            )}
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1 rounded border border-border hover:bg-destructive/20 hover:border-destructive/50 transition-colors text-muted-foreground hover:text-destructive"
            >
              Cancel all
            </button>
            {done.length > 0 && (
              <button
                onClick={() => done.forEach((item) => onRemove(item.id))}
                className="text-xs px-3 py-1 rounded border border-border hover:bg-destructive/20 hover:border-destructive/50 transition-colors text-muted-foreground hover:text-destructive"
              >
                Prune all
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {active.length} pending · {done.length} done
            </span>
          </div>

          {/* Queue list */}
          <div className="flex-1 overflow-y-auto">
            {active.length === 0 && done.length === 0 && (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                Queue is empty. Right-click a track to analyze.
              </div>
            )}
            {active.map((item) => (
              <QueueItemRow
                key={item.id}
                item={item}
                onRemove={onRemove}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            ))}
            {done.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 bg-muted/20">
                  Completed
                </div>
                {done.map((item) => (
                  <QueueItemRow
                    key={item.id}
                    item={item}
                    onRemove={onRemove}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto">
          <HistoryView history={history} onPrune={onPrune} />
        </div>
      )}
    </div>
  );
}

// useState import needed inside this file
import { useState } from "react";
