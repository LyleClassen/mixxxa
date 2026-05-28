import { BrowserWindow, BrowserView, Utils, Updater } from "electrobun/bun";
import type { MixxxRPC } from "../shared/types";
import { MasterDb } from "rbox-js";

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

const rpc = BrowserView.defineRPC<MixxxRPC>({
	maxRequestTime: Infinity,
	handlers: {
		requests: {
			openXmlFile: async () => {
				const files = await Utils.openFileDialog({
					allowedFileTypes: "xml",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: false,
				});
				if (!files || files.length === 0 || files[0] === "") return null;
				const content = await Bun.file(files[0]).text();
				return content;
			},
			getContents: async () => {
				const db = MasterDb.open();
				return db.getContents();
			},
		},
		messages: {},
	},
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

console.log("React Tailwind Vite app started!");
