import type { RPCSchema } from "electrobun/bun";

export interface PlaylistNode {
  id: string;
  name: string;
  isFolder: boolean;
  children: PlaylistNode[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string;
  length: number | null;
  rating: number | null;
  filePath: string | null;
}

export type SyncErrorKind = "not-found" | "unreadable";

export type MixxxRPC = {
  bun: RPCSchema<{
    requests: {
      openXmlFile: { params: undefined; response: string | null };
      syncFromRekordbox: { params: undefined; response: PlaylistNode[] };
      getPlaylistTree: { params: undefined; response: PlaylistNode[] };
      getPlaylistTracks: { params: { playlistId: string }; response: Track[] };
      getTrackAudioUrl: { params: { trackId: string }; response: string | null };
    };
    messages: {};
  }>;
  webview: RPCSchema<{ requests: {}; messages: {} }>;
};
