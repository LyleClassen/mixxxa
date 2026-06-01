import { useState, useEffect } from "react";
import type { PlaylistNode, Track, SyncErrorKind } from "../shared/types";
import { electroview } from "./rpc";
import { WaveformPlayer } from "./WaveformPlayer";

import {
  SkipBack,
  SkipForward,
  Search,
  Disc3,
  Piano,
  Music2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Folder,
  ListMusic,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncState = "idle" | "loading" | "ready" | "error";

function PlaylistTreeNode({
  node,
  selectedId,
  onSelect,
}: {
  node: PlaylistNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.isFolder) {
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children.length > 0 && (
          <div className="pl-4">
            {node.children.map((child) => (
              <PlaylistTreeNode
                key={child.id}
                node={child}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = node.id === selectedId;
  return (
    <button
      onClick={() => onSelect(node.id)}
      className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
        isSelected
          ? "bg-muted/50 text-foreground border-l-2 border-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <ListMusic size={14} className="shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("collection");
  const [playlistTree, setPlaylistTree] = useState<PlaylistNode[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadedTrack, setLoadedTrack] = useState<Track | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<SyncErrorKind | null>(null);

  useEffect(() => {
    electroview.rpc!.request.getPlaylistTree().then((tree) => {
      if (tree.length > 0) {
        setPlaylistTree(tree);
        setSyncState("ready");
      }
    }).catch(() => {});
  }, []);

  async function handleSync() {
    setSyncState("loading");
    setSyncError(null);
    try {
      const tree = await electroview.rpc!.request.syncFromRekordbox();
      setPlaylistTree(tree);
      setSelectedPlaylistId(null);
      setTracks([]);
      setSyncState("ready");
    } catch (err: unknown) {
      const kind = (err as { syncErrorKind?: SyncErrorKind }).syncErrorKind ?? null;
      setSyncError(kind);
      setSyncState("error");
    }
  }

  async function handleSelectPlaylist(playlistId: string) {
    setSelectedPlaylistId(playlistId);
    setTracks([]);
    try {
      const result = await electroview.rpc!.request.getPlaylistTracks({ playlistId });
      setTracks(result);
    } catch {
      setTracks([]);
    }
  }

  function syncErrorMessage(): string {
    if (syncError === "not-found") {
      return "Rekordbox library not found. Please install and open Rekordbox first.";
    }
    if (syncError === "unreadable") {
      return "Could not read the Rekordbox library. Close Rekordbox and try again.";
    }
    return "Sync failed. Please try again.";
  }

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
            <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <button className="hover:text-foreground transition-colors">TUTORIALS</button>
              <button className="hover:text-foreground transition-colors">SOFTWARE</button>
            </div>
          </div>
        </header>

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
                placeholder="Search tracks"
                className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/70"
              />
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {tracks.length} TRACKS
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {selectedPlaylistId && tracks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                No tracks in this playlist.
              </div>
            ) : !selectedPlaylistId && tracks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                {syncState === "ready" || playlistTree.length > 0
                  ? "Select a playlist to view tracks."
                  : "Sync your Rekordbox library to get started."}
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-background z-10 shadow-sm border-b border-border">
                  <tr className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Cover Art</th>
                    <th className="px-6 py-4 font-medium">Artist</th>
                    <th className="px-6 py-4 font-medium w-full">Title</th>
                    <th className="px-6 py-4 font-medium text-right">BPM</th>
                    <th className="px-6 py-4 font-medium">Key</th>
                    <th className="px-6 py-4 font-medium text-right">Length</th>
                    <th className="px-6 py-4 font-medium text-center">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {tracks.map((track) => (
                    <tr key={track.id} onDoubleClick={() => setLoadedTrack(track)} className="hover:bg-muted/30 transition-colors group cursor-pointer">
                      <td className="px-6 py-2.5">
                        <div className="w-12 h-8 rounded-sm bg-muted shadow-sm border border-border/50 flex items-center justify-center">
                          <Music2 size={14} className="text-muted-foreground/50" />
                        </div>
                      </td>
                      <td className="px-6 py-2.5 font-medium">{track.artist || "—"}</td>
                      <td className="px-6 py-2.5 text-muted-foreground group-hover:text-foreground transition-colors">
                        {track.title || "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                        {track.bpm != null ? track.bpm : "—"}
                      </td>
                      <td className="px-6 py-2.5">
                        {track.key ? (
                          <span className="bg-muted px-2 py-0.5 rounded text-xs font-bold inline-block min-w-[36px] text-center border border-border">
                            {track.key}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                        {track.length != null
                          ? `${Math.floor(track.length / 60)}:${String(track.length % 60).padStart(2, "0")}`
                          : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-center text-muted-foreground font-mono">
                        {track.rating != null ? track.rating : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
