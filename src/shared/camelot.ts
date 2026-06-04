// Camelot wheel mapping: "Note scale" → Camelot notation
// Used by both the Essentia renderer worker and the ORBIT Bun-side engine.
export const CAMELOT_MAP: Record<string, string> = {
  "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B",
  "E major": "12B", "B major": "1B", "F# major": "2B", "Db major": "3B",
  "Ab major": "4B", "Eb major": "5B", "Bb major": "6B", "F major": "7B",
  "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A",
  "C# minor": "12A", "G# minor": "1A", "D# minor": "2A", "Bb minor": "3A",
  "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
};

export function normalizeKey(key: string, scale: string): string {
  const full = `${key} ${scale}`;
  return CAMELOT_MAP[full] ?? full;
}
