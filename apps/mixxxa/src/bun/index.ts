import { BrowserWindow, BrowserView, Utils, Updater } from "electrobun/bun";
import { join } from "node:path";
import type { MixxxRPC } from "../shared/types";
import { rpcHandlers } from "./rpc/index";
import { initRekordboxHandlers } from "./rpc/rekordbox";
import { initWriteBackHandlers, initWriteBack } from "./rpc/rekordbox-writeback";
import { initAnalysisHandlers } from "./rpc/analysis";
import { initWaveformHandlers } from "./rpc/waveform";
import { initCueHandlers, initCues } from "./rpc/cues";
import { initIdentifyHandlers, initIdentify } from "./rpc/identify";
import { initLibraryPathsHandlers } from "./rpc/libraryPaths";
import { closeDb, getDb } from "./db/localDb";
import { startAudioServer, stopAudioServer } from "./audioServer";
import { initAnalysis } from "./analysis/index";
import { loadSettings } from "./analysis/settings";
import { initBunLog, bunLog } from "./bunLog";
import { checkToolchain } from "./analysis/binaries";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		// A bare connection check is not enough: a stale Vite left over from
		// another cwd (or any unrelated process) holding 5173 accepts the socket
		// and then serves 404, which loads as a blank window. Require a 2xx that
		// actually contains this app's entry so we only attach to *our* server.
		try {
			const res = await fetch(DEV_SERVER_URL, {
				signal: AbortSignal.timeout(2000),
			});
			const html = res.ok ? await res.text() : "";
			if (res.ok && html.includes("/main.tsx")) {
				console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
				return DEV_SERVER_URL;
			}
			console.warn(
				`Port ${DEV_SERVER_PORT} is serving something that is not the mixxxa view (HTTP ${res.status}). Falling back to the bundled view — check for a stale 'vite' process.`,
			);
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

initRekordboxHandlers(Utils.paths.userData);
initWriteBackHandlers(Utils.paths.userData);
initAnalysisHandlers(Utils.paths.userData);
initWaveformHandlers(Utils.paths.userData);
initCueHandlers(Utils.paths.userData);
initIdentifyHandlers(Utils.paths.userData);
initLibraryPathsHandlers(Utils.paths.userData);
startAudioServer(Utils.paths.userData);

const db = getDb(Utils.paths.userData);

const settings = loadSettings(db);
// User-writable location — app bundles are read-only once signed/notarised.
const logsDir = join(Utils.paths.userData, "logs");
initBunLog(logsDir, settings.maxLogFiles);
bunLog("BOOT", `mixxxa started — userData=${Utils.paths.userData} logsDir=${logsDir}`);

const toolchain = checkToolchain();
bunLog("BOOT", `toolchain — ffmpeg=${toolchain.ffmpeg ?? "NOT FOUND"} ffprobe=${toolchain.ffprobe ?? "NOT FOUND"}`);

const rpc = BrowserView.defineRPC<MixxxRPC>({
	maxRequestTime: Infinity,
	handlers: rpcHandlers,
});

initAnalysis(db, (items) => {
  rpc.send.analysisQueueUpdate({ queue: items });
});

initCues((p) => {
  rpc.send.autoCueProgress(p);
});

initWriteBack((p) => {
  rpc.send.writeBackProgress(p);
});

initIdentify((p) => {
  rpc.send.identifyProgress(p);
});

const url = await getMainViewUrl();

new BrowserWindow({
	title: "Mixxxa",
	url,
	rpc,
	frame: {
		width: 1920,
		height: 1080,
		x: 200,
		y: 200,
	},
});

process.on("exit", () => {
  bunLog("BOOT", "mixxxa shutting down");
  closeDb();
  stopAudioServer();
});

console.log("React Tailwind Vite app started!");
