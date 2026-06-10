// Shared column metadata for both the classic TrackTable and the MRT-based
// MaterialTrackTable. Single source of truth so the two stay aligned.

export interface ColumnDef {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  alwaysVisible: boolean;
}

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: "cover",                   label: "Cover Art",        defaultWidth: 80,  minWidth: 40, alwaysVisible: false },
  { id: "artist",                  label: "Artist",           defaultWidth: 160, minWidth: 40, alwaysVisible: false },
  { id: "title",                   label: "Title",            defaultWidth: 200, minWidth: 40, alwaysVisible: true  },
  { id: "album",                   label: "Album",            defaultWidth: 160, minWidth: 40, alwaysVisible: false },
  { id: "bpm",                     label: "BPM",              defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
  { id: "key",                     label: "Key",              defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
  { id: "length",                  label: "Time",             defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
  { id: "bitrate",                 label: "Bitrate",          defaultWidth: 80,  minWidth: 40, alwaysVisible: false },
  { id: "analyzed_bitrate",        label: "Analyzed Bitrate", defaultWidth: 100, minWidth: 50, alwaysVisible: false },
  { id: "analyzed_energy",         label: "Energy",           defaultWidth: 80,  minWidth: 50, alwaysVisible: false },
  { id: "analyzed_loudness_db",    label: "Loudness",         defaultWidth: 85,  minWidth: 50, alwaysVisible: false },
  { id: "analyzed_dynamic_range",  label: "Dyn. Range",       defaultWidth: 85,  minWidth: 50, alwaysVisible: false },
  { id: "analyzed_danceability",   label: "Danceability",     defaultWidth: 90,  minWidth: 50, alwaysVisible: false },
  { id: "rating",                  label: "Rating",           defaultWidth: 70,  minWidth: 40, alwaysVisible: false },
];

export const DEFAULT_HIDDEN = new Set<string>([
  "analyzed_bitrate",
  "analyzed_loudness_db",
  "analyzed_dynamic_range",
  "analyzed_danceability",
]);

// Columns that were removed from DEFAULT_HIDDEN in a past release. On load they
// are treated as a migration (auto-shown) rather than a stored user preference.
export const PREVIOUSLY_DEFAULT_HIDDEN = ["analyzed_energy"];

// Right-aligned numeric/metric columns (mirrors the classic table).
export const RIGHT_ALIGNED = new Set<string>([
  "bpm",
  "length",
  "bitrate",
  "analyzed_bitrate",
  "analyzed_energy",
  "analyzed_loudness_db",
  "analyzed_dynamic_range",
  "analyzed_danceability",
  "rating",
]);

export const CENTER_ALIGNED = new Set<string>(["rating"]);
