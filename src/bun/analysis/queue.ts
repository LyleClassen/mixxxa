import type { Database } from "bun:sqlite";
import type {
  AnalysisAspect,
  QueueItem,
  QueueItemStatus,
  AnalysisPhase,
  QueueItemTimings,
} from "../../shared/types";

export interface QueueRow {
  id: string;
  track_id: string;
  aspects: string;
  status: QueueItemStatus;
  phase: AnalysisPhase | null;
  progress: number;
  error: string | null;
  time_decode_ms: number | null;
  time_key_ms: number | null;
  time_bpm_ms: number | null;
  time_total_ms: number | null;
  seq: number;
  created_at: number;
}

type TrackMeta = { title: string; artist: string };

function rowToItem(row: QueueRow, meta: TrackMeta): QueueItem {
  return {
    id: row.id,
    trackId: row.track_id,
    trackTitle: meta.title,
    trackArtist: meta.artist,
    aspects: JSON.parse(row.aspects) as AnalysisAspect[],
    status: row.status,
    phase: row.phase,
    progress: row.progress,
    error: row.error,
    timeDecodeMs: row.time_decode_ms ?? undefined,
    timeKeyMs: row.time_key_ms ?? undefined,
    timeBpmMs: row.time_bpm_ms ?? undefined,
    timeTotalMs: row.time_total_ms ?? undefined,
  };
}

export class AnalysisQueueStore {
  constructor(private readonly db: Database) {}

  getAll(): QueueItem[] {
    const rows = this.db.query<QueueRow, []>(
      "SELECT * FROM analysis_queue ORDER BY seq ASC"
    ).all();
    return rows.map((row) => rowToItem(row, this._trackMeta(row.track_id)));
  }

  getQueued(): QueueRow[] {
    return this.db.query<QueueRow, []>(
      "SELECT * FROM analysis_queue WHERE status = 'queued' ORDER BY seq ASC"
    ).all();
  }

  getItem(id: string): QueueRow | null {
    return this.db.query<QueueRow, [string]>(
      "SELECT * FROM analysis_queue WHERE id = ?"
    ).get(id) ?? null;
  }

  isAlreadyQueued(trackId: string): boolean {
    const row = this.db.query<{ id: string }, [string]>(
      "SELECT id FROM analysis_queue WHERE track_id = ? AND status IN ('queued','running') LIMIT 1"
    ).get(trackId);
    return row != null;
  }

  add(item: { id: string; trackId: string; aspects: AnalysisAspect[] }): void {
    const maxSeq = this.db.query<{ s: number | null }, []>(
      "SELECT MAX(seq) AS s FROM analysis_queue"
    ).get()?.s ?? -1;

    this.db.run(
      `INSERT INTO analysis_queue
        (id, track_id, aspects, status, phase, progress, error, seq, created_at)
       VALUES (?, ?, ?, 'queued', NULL, 0, NULL, ?, ?)`,
      item.id,
      item.trackId,
      JSON.stringify(item.aspects),
      maxSeq + 1,
      Date.now(),
    );
  }

  setStatus(id: string, status: QueueItemStatus, error?: string): void {
    this.db.run(
      "UPDATE analysis_queue SET status = ?, error = ? WHERE id = ?",
      status,
      error ?? null,
      id,
    );
  }

  setPhaseProgress(id: string, phase: AnalysisPhase, progress: number, timings?: Partial<QueueItemTimings>): void {
    this.db.run(
      `UPDATE analysis_queue SET phase = ?, progress = ?,
        time_decode_ms = COALESCE(?, time_decode_ms),
        time_key_ms = COALESCE(?, time_key_ms),
        time_bpm_ms = COALESCE(?, time_bpm_ms),
        time_total_ms = COALESCE(?, time_total_ms)
       WHERE id = ?`,
      phase, progress,
      timings?.timeDecodeMs ?? null,
      timings?.timeKeyMs ?? null,
      timings?.timeBpmMs ?? null,
      timings?.timeTotalMs ?? null,
      id,
    );
  }

  remove(id: string): void {
    // Allow pruning any item that isn't actively running (queued, failed,
    // done, or canceled). Running items are left alone until they report.
    this.db.run("DELETE FROM analysis_queue WHERE id = ? AND status != 'running'", id);
  }

  cancelAll(): void {
    // Mark queued items as canceled; running items will be discarded when they report
    this.db.run("UPDATE analysis_queue SET status = 'canceled' WHERE status = 'queued'");
  }

  resetRunningToQueued(): void {
    this.db.run("UPDATE analysis_queue SET status = 'queued', phase = NULL, progress = 0 WHERE status = 'running'");
  }

  moveUp(id: string): void {
    const item = this.getItem(id);
    if (!item || item.status !== "queued") return;

    const prev = this.db.query<{ id: string; seq: number }, [number]>(
      "SELECT id, seq FROM analysis_queue WHERE status = 'queued' AND seq < ? ORDER BY seq DESC LIMIT 1"
    ).get(item.seq);
    if (!prev) return;

    this.db.run("UPDATE analysis_queue SET seq = ? WHERE id = ?", item.seq, prev.id);
    this.db.run("UPDATE analysis_queue SET seq = ? WHERE id = ?", prev.seq, id);
  }

  moveDown(id: string): void {
    const item = this.getItem(id);
    if (!item || item.status !== "queued") return;

    const next = this.db.query<{ id: string; seq: number }, [number]>(
      "SELECT id, seq FROM analysis_queue WHERE status = 'queued' AND seq > ? ORDER BY seq ASC LIMIT 1"
    ).get(item.seq);
    if (!next) return;

    this.db.run("UPDATE analysis_queue SET seq = ? WHERE id = ?", item.seq, next.id);
    this.db.run("UPDATE analysis_queue SET seq = ? WHERE id = ?", next.seq, id);
  }

  private _trackMeta(trackId: string): TrackMeta {
    type Row = { title: string | null; artist_name: string | null };
    const row = this.db.query<Row, [string]>(`
      SELECT c.title, a.name AS artist_name
      FROM content c
      LEFT JOIN artist a ON a.id = c.artist_id
      WHERE c.id = ?
    `).get(trackId);
    return {
      title: row?.title ?? "",
      artist: row?.artist_name ?? "",
    };
  }
}
