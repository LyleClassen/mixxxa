import { getDb } from "../db/localDb";
import { loadSettings } from "../analysis/settings";
import { bunLog } from "../bunLog";
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
  AnalysisSettings,
} from "../../shared/types";

let dataDir: string;

export function initAnalysisHandlers(appDataDir: string): void {
  dataDir = appDataDir;
}

export const analysisHandlers = {
  enqueueTrack: async ({ trackId }: { trackId: string }): Promise<void> => {
    const db = getDb(dataDir);
    const settings = loadSettings(db);
    bunLog("RPC", `enqueueTrack: trackId=${trackId}`);
    enqueueTrack(db, trackId, settings);
  },

  enqueuePlaylist: async ({ playlistId }: { playlistId: string }): Promise<void> => {
    const db = getDb(dataDir);
    const settings = loadSettings(db);
    bunLog("RPC", `enqueuePlaylist: playlistId=${playlistId}`);
    enqueuePlaylist(db, playlistId, settings);
  },

  getAnalysisQueue: async (): Promise<ReturnType<typeof getQueue>> => {
    return getQueue(getDb(dataDir));
  },

  pauseAnalysis: async (): Promise<void> => {
    bunLog("RPC", "pauseAnalysis");
    pauseAnalysis();
  },

  resumeAnalysis: async (): Promise<void> => {
    bunLog("RPC", "resumeAnalysis");
    resumeAnalysis(getDb(dataDir));
  },

  cancelAnalysis: async (): Promise<void> => {
    bunLog("RPC", "cancelAnalysis");
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

  setAnalysisSettings: async (patch: Partial<AnalysisSettings>) => {
    bunLog("RPC", `setAnalysisSettings: ${JSON.stringify(patch)}`);
    return setAnalysisSettings(getDb(dataDir), patch);
  },

  getAnalysisHistory: async () => {
    return getHistory(getDb(dataDir));
  },

  pruneAnalysisHistory: async (): Promise<void> => {
    bunLog("RPC", "pruneAnalysisHistory");
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
