import { BrowserWindow, BrowserView, Utils, Updater } from "electrobun/bun";
import type { MixxxRPC } from "../shared/types";
import { rpcHandlers } from "./rpc/index";
import { initRekordboxHandlers } from "./rpc/rekordbox";
import { closeDb } from "./db/localDb";

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

const rpc = BrowserView.defineRPC<MixxxRPC>({
	maxRequestTime: Infinity,
	handlers: rpcHandlers,
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

process.on("exit", () => closeDb());

console.log("React Tailwind Vite app started!");
