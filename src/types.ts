export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  bpm: number;
  key: string;
  duration: number; // seconds
  genre: string;
  file_path: string;
}

export interface Playlist {
  id: string;
  name: string;
  track_ids: string[];
}

export interface Folder {
  id: string;
  name: string;
  children: NavNode[];
}

export type NavNode =
  | { type: 'Folder'; id: string; name: string; children: NavNode[] }
  | { type: 'Playlist'; id: string; name: string; track_ids: string[] };

export type NavView =
  | { kind: 'all' }
  | { kind: 'playlist'; playlistId: string; name: string };
