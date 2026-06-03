import { BrowserWindow, BrowserView, Utils, Updater } from "electrobun/bun";
import type { MixxxRPC } from "../shared/types";
import { rpcHandlers } from "./rpc/index";
import { initRekordboxHandlers } from "./rpc/rekordbox";
import { initAnalysisHandlers } from "./rpc/analysis";
import { closeDb, getDb } from "./db/localDb";
import { startAudioServer, stopAudioServer } from "./audioServer";
import { initAnalysis } from "./analysis/index";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

initRekordboxHandlers(Utils.paths.userData);
initAnalysisHandlers(Utils.paths.userData);
startAudioServer(Utils.paths.userData);

// Init analysis queue — queue updates will be pushed to the view once the RPC is ready
const db = getDb(Utils.paths.userData);

const rpc = BrowserView.defineRPC<MixxxRPC>({
	maxRequestTime: Infinity,
	handlers: rpcHandlers,
});

initAnalysis(db, (items) => {
  rpc.send.analysisQueueUpdate({ queue: items });
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
  closeDb();
  stopAudioServer();
});

console.log("React Tailwind Vite app started!");
