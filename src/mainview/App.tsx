import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { PlaylistNode, Track, SyncErrorKind, QueueItem, HistoryEntry, AnalysisSettings } from "../shared/types";
import { electroview } from "./rpc";
import { WaveformPlayer } from "./features/player/WaveformPlayer";
import {
  TrackTableSwitch,
  TrackTableModeToggle,
  useTrackTableMode,
} from "./features/track-table";
import { AnalysisPanel } from "./features/analysis/AnalysisPanel";
import { SettingsPage } from "./features/settings/SettingsPage";
import { PlaylistTreeNode } from "./features/sidebar/PlaylistTreeNode";
import { useDebounce } from "./hooks/useDebounce";
import { initWorkerPool, setPoolSize } from "./analysis/workerPool";

import {
  SkipBack,
  SkipForward,
  Search,
  Disc3,
  Piano,
  RefreshCw,
  Library,
  ListTodo,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const COLLECTION_ID = "__collection__";
const SELECTED_PLAYLIST_KEY = "mixxxa.selectedPlaylistId";

type SyncState = "idle" | "loading" | "ready" | "error";
type RightPanel = "analysis" | "settings" | null;

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState("collection");
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [playlistTree, setPlaylistTree] = useState<PlaylistNode[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(() => {
    return localStorage.getItem(SELECTED_PLAYLIST_KEY) ?? COLLECTION_ID;
  });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadedTrack, setLoadedTrack] = useState<Track | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<SyncErrorKind | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableMode, setTableMode] = useTrackTableMode();

  // Analysis state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [analysisSettings, setAnalysisSettingsState] = useState<AnalysisSettings>({
    parallelism: 2,
    aspects: ["key", "bpm"],
    engine: "essentia",
  });
  const [isPaused, setIsPaused] = useState(false);
  const workerPoolInitialized = useRef(false);

  const debouncedSearch = useDebounce(searchQuery, 200);

  const filteredTracks = useMemo(() => {
    if (!debouncedSearch.trim()) return tracks;
    const q = debouncedSearch.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album ?? "").toLowerCase().includes(q)
    );
  }, [tracks, debouncedSearch]);

  // ── Initialize analysis worker pool + settings ──────────────────────────────

  useEffect(() => {
    if (workerPoolInitialized.current) return;
    workerPoolInitialized.current = true;

    electroview.rpc!.request.getAnalysisSettings().then((s) => {
      setAnalysisSettingsState(s);
      initWorkerPool(s, async (method, params) => {
        return (electroview.rpc!.request as Record<string, (p?: unknown) => Promise<unknown>>)[method]?.(params);
      });
    }).catch(() => {
      initWorkerPool(analysisSettings, async (method, params) => {
        return (electroview.rpc!.request as Record<string, (p?: unknown) => Promise<unknown>>)[method]?.(params);
      });
    });

    // Load initial queue + history
    electroview.rpc!.request.getAnalysisQueue().then(setQueue).catch(() => {});
    electroview.rpc!.request.getAnalysisHistory().then(setHistory).catch(() => {});
  }, []);

  // Subscribe to queue updates from Bun
  useEffect(() => {
    if (!electroview.rpc) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyRpc = electroview.rpc as any;
    const handler = (msg: { queue: QueueItem[] }) => {
      setQueue(msg.queue);
      if (msg.queue.some((i) => i.status === "done")) {
        reloadTracks();
      }
    };
    anyRpc.addMessageListener("analysisQueueUpdate", handler);
    return () => {
      anyRpc.removeMessageListener("analysisQueueUpdate", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaylistId]);

  function reloadTracks() {
    if (selectedPlaylistId === COLLECTION_ID) {
      electroview.rpc!.request.getAllTracks().then(setTracks).catch(() => {});
    } else {
      electroview.rpc!.request.getPlaylistTracks({ playlistId: selectedPlaylistId }).then(setTracks).catch(() => {});
    }
  }

  // ── Load playlist tree ──────────────────────────────────────────────────────

  useEffect(() => {
    electroview.rpc!.request.getPlaylistTree().then((tree) => {
      if (tree.length > 0) {
        setPlaylistTree(tree);
        setSyncState("ready");
      }
    }).catch(() => {});
  }, []);

  // ── Load tracks on selection change ────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setTracks([]);

    if (selectedPlaylistId === COLLECTION_ID) {
      electroview.rpc!.request.getAllTracks().then((result) => {
        if (!cancelled) setTracks(result);
      }).catch(() => {
        if (!cancelled) setTracks([]);
      });
    } else {
      electroview.rpc!.request.getPlaylistTracks({ playlistId: selectedPlaylistId }).then((result) => {
        if (!cancelled) setTracks(result);
      }).catch(() => {
        if (!cancelled) setTracks([]);
      });
    }

    return () => { cancelled = true; };
  }, [selectedPlaylistId]);

  // ── Sync ────────────────────────────────────────────────────────────────────

  async function handleSync() {
    setSyncState("loading");
    setSyncError(null);
    try {
      const tree = await electroview.rpc!.request.syncFromRekordbox();
      setPlaylistTree(tree);
      setSelectedPlaylistId(COLLECTION_ID);
      setTracks([]);
      setSyncState("ready");
    } catch (err: unknown) {
      const kind = (err as { syncErrorKind?: SyncErrorKind }).syncErrorKind ?? null;
      setSyncError(kind);
      setSyncState("error");
    }
  }

  const handleSelectPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setSearchQuery("");
    localStorage.setItem(SELECTED_PLAYLIST_KEY, playlistId);
  }, []);

  function syncErrorMessage(): string {
    if (syncError === "not-found") {
      return "Rekordbox library not found. Please install and open Rekordbox first.";
    }
    if (syncError === "unreadable") {
      return "Could not read the Rekordbox library. Close Rekordbox and try again.";
    }
    return "Sync failed. Please try again.";
  }

  // ── Analysis actions ────────────────────────────────────────────────────────

  const handleAnalyzeTrack = useCallback(async (track: Track) => {
    await electroview.rpc!.request.enqueueTrack({ trackId: track.id });
    setRightPanel("analysis");
    const updated = await electroview.rpc!.request.getAnalysisQueue();
    setQueue(updated);
  }, []);

  const handleAnalyzePlaylist = useCallback(async (playlistId: string) => {
    await electroview.rpc!.request.enqueuePlaylist({ playlistId });
    setRightPanel("analysis");
    const updated = await electroview.rpc!.request.getAnalysisQueue();
    setQueue(updated);
  }, []);

  async function handlePause() {
    await electroview.rpc!.request.pauseAnalysis();
    setIsPaused(true);
  }

  async function handleResume() {
    await electroview.rpc!.request.resumeAnalysis();
    setIsPaused(false);
  }

  async function handleCancel() {
    await electroview.rpc!.request.cancelAnalysis();
    const updated = await electroview.rpc!.request.getAnalysisQueue();
    setQueue(updated);
  }

  async function handleRemoveItem(itemId: string) {
    await electroview.rpc!.request.removeQueueItem({ itemId });
    const updated = await electroview.rpc!.request.getAnalysisQueue();
    setQueue(updated);
  }

  async function handleMoveItem(itemId: string, direction: "up" | "down") {
    await electroview.rpc!.request.moveQueueItem({ itemId, direction });
    const updated = await electroview.rpc!.request.getAnalysisQueue();
    setQueue(updated);
  }

  async function handlePruneHistory() {
    await electroview.rpc!.request.pruneAnalysisHistory();
    setHistory([]);
  }

  async function handleSettingsChange(patch: Partial<AnalysisSettings>) {
    const updated = await electroview.rpc!.request.setAnalysisSettings(patch);
    setAnalysisSettingsState(updated);
    // Apply new parallelism to worker pool
    if (patch.parallelism !== undefined) {
      setPoolSize(updated.parallelism);
    }
  }

  function togglePanel(panel: RightPanel) {
    setRightPanel((cur) => cur === panel ? null : panel);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans selection:bg-primary/30">

      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-card border-r border-border shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <Disc3 size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight">MIXXXA</span>
        </div>

        {/* Camelot Wheel Placeholder */}
        <div className="px-6 py-4 flex justify-center">
          <div className="relative w-48 h-48 rounded-full border-8 border-muted flex items-center justify-center shadow-[0_0_30px_rgba(163,230,53,0.1)]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent/20 to-primary/20 opacity-50 blur-xl"></div>
            <div className="text-center z-10">
              <span className="text-2xl font-black text-primary">11B</span>
              <div className="text-xs text-muted-foreground mt-1">A Major</div>
            </div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50 rotate-45"></div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50 -rotate-45"></div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50 rotate-90"></div>
            <div className="absolute top-0 left-1/2 w-1 h-full -translate-x-1/2 bg-muted/50"></div>
          </div>
        </div>

        {/* Playlist tree */}
        <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => handleSelectPlaylist(COLLECTION_ID)}
            className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
              selectedPlaylistId === COLLECTION_ID
                ? "bg-muted/50 text-foreground border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Library size={14} className="shrink-0" />
            <span className="truncate font-medium">Collection</span>
          </button>

          {syncState === "idle" && playlistTree.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Click Sync to load your Rekordbox library.
            </p>
          )}
          {syncState === "loading" && (
            <p className="px-3 py-2 text-xs text-muted-foreground animate-pulse">
              Syncing…
            </p>
          )}
          {syncState === "error" && (
            <p className="px-3 py-2 text-xs text-destructive">
              {syncErrorMessage()}
            </p>
          )}
          {playlistTree.map((node) => (
            <PlaylistTreeNode
              key={node.id}
              node={node}
              selectedId={selectedPlaylistId}
              onSelect={handleSelectPlaylist}
              onAnalyzePlaylist={handleAnalyzePlaylist}
            />
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header Tabs */}
        <header className="h-16 flex items-center justify-between border-b border-border px-6 bg-card shrink-0">
          <div className="flex h-full">
            <button
              onClick={() => setActiveTab("collection")}
              className={`px-6 h-full font-semibold text-sm border-b-2 transition-colors ${activeTab === "collection" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              COLLECTION
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`px-6 h-full font-semibold text-sm border-b-2 transition-colors ${activeTab === "tags" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              EDIT TAGS
            </button>
            <button
              onClick={() => setActiveTab("personalize")}
              className={`px-6 h-full font-semibold text-sm border-b-2 transition-colors ${activeTab === "personalize" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              PERSONALIZE
            </button>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSync}
              disabled={syncState === "loading"}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 font-bold"
            >
              <RefreshCw size={14} className={syncState === "loading" ? "animate-spin" : ""} />
              SYNC
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <button
                onClick={() => togglePanel("analysis")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  rightPanel === "analysis"
                    ? "bg-muted text-foreground"
                    : "hover:text-foreground"
                }`}
              >
                <ListTodo size={14} />
                ANALYSIS
                {queue.some((i) => i.status === "running" || i.status === "queued") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
              <button
                onClick={() => togglePanel("settings")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  rightPanel === "settings"
                    ? "bg-muted text-foreground"
                    : "hover:text-foreground"
                }`}
              >
                <Settings size={14} />
                SETTINGS
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          {/* Left: player + track list */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Player Section */}
            <section className="p-6 border-b border-border bg-card/50 flex flex-col gap-4 shrink-0">
              <WaveformPlayer track={loadedTrack} />

              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-light tracking-tight mb-2">
                    {loadedTrack
                      ? `${loadedTrack.artist ? loadedTrack.artist + " – " : ""}${loadedTrack.title || "Unknown"}`
                      : "No track loaded"}
                  </h2>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Key</span>
                      {loadedTrack?.key ? (
                        <span className="bg-key-cyan text-black px-2 py-0.5 rounded text-xs font-bold">{loadedTrack.key}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">BPM</span>
                      {loadedTrack?.bpm != null ? (
                        <span className="bg-muted px-2 py-0.5 rounded text-xs font-medium border border-border">{loadedTrack.bpm}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4 border-l border-border pl-6">
                      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Cue Points</span>
                      <div className="flex items-center gap-1">
                        <button className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 text-muted-foreground transition-colors"><SkipBack size={14} /></button>
                        <button className="w-6 h-6 flex items-center justify-center bg-muted rounded hover:bg-muted/80 text-muted-foreground transition-colors"><SkipForward size={14} /></button>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-xs border-dashed text-muted-foreground hover:text-foreground">ADD CUE</Button>
                    </div>
                    <div className="flex items-center gap-2 ml-4 border-l border-border pl-6">
                      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Virtual Piano</span>
                      <button className="p-1 hover:text-primary transition-colors"><Piano size={18} /></button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Track List */}
            <section className="flex-1 flex flex-col min-h-0 bg-background">
              <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tracks"
                    className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/70"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <TrackTableModeToggle mode={tableMode} onChange={setTableMode} />
                  <div className="text-sm font-medium text-muted-foreground">
                    {filteredTracks.length} TRACKS
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                {filteredTracks.length === 0 && debouncedSearch.trim() ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    No tracks found.
                  </div>
                ) : filteredTracks.length === 0 && selectedPlaylistId !== COLLECTION_ID ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    {tracks.length === 0
                      ? syncState === "ready" || playlistTree.length > 0
                        ? "No tracks in this playlist."
                        : "Sync your Rekordbox library to get started."
                      : "No tracks found."}
                  </div>
                ) : filteredTracks.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    {syncState === "ready" || playlistTree.length > 0
                      ? "No tracks in your library yet. Sync to import."
                      : "Sync your Rekordbox library to get started."}
                  </div>
                ) : (
                  <TrackTableSwitch
                    mode={tableMode}
                    tracks={filteredTracks}
                    onTrackDoubleClick={setLoadedTrack}
                    onAnalyzeTrack={handleAnalyzeTrack}
                    onAnalyzePlaylist={handleAnalyzePlaylist}
                    storageKey="mixxxa.trackTableColumns"
                    currentPlaylistId={selectedPlaylistId === COLLECTION_ID ? null : selectedPlaylistId}
                  />
                )}
              </div>
            </section>
          </div>

          {/* Right panel: Analysis or Settings */}
          {rightPanel && (
            <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {rightPanel === "analysis" ? "Analysis" : "Settings"}
                </span>
                <button
                  onClick={() => setRightPanel(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {rightPanel === "analysis" && (
                  <AnalysisPanel
                    queue={queue}
                    history={history}
                    isPaused={isPaused}
                    onPause={handlePause}
                    onResume={handleResume}
                    onCancel={handleCancel}
                    onRemove={handleRemoveItem}
                    onMoveUp={(id) => handleMoveItem(id, "up")}
                    onMoveDown={(id) => handleMoveItem(id, "down")}
                    onPrune={handlePruneHistory}
                  />
                )}
                {rightPanel === "settings" && (
                  <SettingsPage
                    settings={analysisSettings}
                    onChange={handleSettingsChange}
                  />
                )}
              </div>
            </aside>
          )}
        </div>

      </main>
    </div>
  );
}

export default App;
