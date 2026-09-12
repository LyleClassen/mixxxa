import type { WaveformData } from "../../shared/types";
import { getDb, readWaveformData, writeWaveformPeaks } from "../db/localDb";

let dataDir: string;

export function initWaveformHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

export const waveformHandlers = {
  getWaveformData: async ({ trackId }: { trackId: string }): Promise<WaveformData | null> => {
    const db = getDb(dataDir);
    return readWaveformData(db, trackId);
  },

  saveWaveformPeaks: async ({ trackId, peaks, duration }: { trackId: string; peaks: number[]; duration: number }): Promise<void> => {
    const db = getDb(dataDir);
    writeWaveformPeaks(db, trackId, JSON.stringify(peaks), duration);
  },
};
