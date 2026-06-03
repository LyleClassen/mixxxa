import { getDb } from "../db/localDb";
import { loadSettings } from "../analysis/settings";
import {
  getQueue,
  enqueueTrack,
  enqueuePlaylist,
  pauseAnalysis,
  resumeAnalysis,
  cancelAnalysis,
  removeQueueItem,
  moveQueueItem,
  getAnalysisSettings,
  setAnalysisSettings,
  getHistory,
  pruneHistory,
  claimWork,
  reportProgress,
  reportResult,
} from "../analysis/index";
import type {
  ProgressReport,
  AnalysisResult,
} from "../../shared/types";

let dataDir: string;

export function initAnalysisHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

export const analysisHandlers = {
  enqueueTrack: async ({ trackId }: { trackId: string }): Promise<void> => {
    const db = getDb(dataDir);
    const settings = loadSettings(db);
    enqueueTrack(db, trackId, settings);
  },

  enqueuePlaylist: async ({ playlistId }: { playlistId: string }): Promise<void> => {
    const db = getDb(dataDir);
    const settings = loadSettings(db);
    enqueuePlaylist(db, playlistId, settings);
  },

  getAnalysisQueue: async (): Promise<ReturnType<typeof getQueue>> => {
    return getQueue(getDb(dataDir));
  },

  pauseAnalysis: async (): Promise<void> => {
    pauseAnalysis();
  },

  resumeAnalysis: async (): Promise<void> => {
    resumeAnalysis(getDb(dataDir));
  },

  cancelAnalysis: async (): Promise<void> => {
    cancelAnalysis(getDb(dataDir));
  },

  removeQueueItem: async ({ itemId }: { itemId: string }): Promise<void> => {
    removeQueueItem(getDb(dataDir), itemId);
  },

  moveQueueItem: async ({ itemId, direction }: { itemId: string; direction: "up" | "down" }): Promise<void> => {
    moveQueueItem(getDb(dataDir), itemId, direction);
  },

  getAnalysisSettings: async () => {
    return getAnalysisSettings(getDb(dataDir));
  },

  setAnalysisSettings: async (patch: { parallelism?: number; aspects?: string[] }) => {
    return setAnalysisSettings(getDb(dataDir), patch as Parameters<typeof setAnalysisSettings>[1]);
  },

  getAnalysisHistory: async () => {
    return getHistory(getDb(dataDir));
  },

  pruneAnalysisHistory: async (): Promise<void> => {
    pruneHistory(getDb(dataDir));
  },

  claimAnalysisWork: async (): Promise<ReturnType<typeof claimWork>> => {
    return claimWork(getDb(dataDir));
  },

  reportAnalysisProgress: async (report: ProgressReport): Promise<void> => {
    reportProgress(getDb(dataDir), report);
  },

  reportAnalysisResult: async (result: AnalysisResult): Promise<void> => {
    reportResult(getDb(dataDir), result);
  },
};
