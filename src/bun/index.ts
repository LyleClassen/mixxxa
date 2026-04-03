import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// RPC schema shared between bun and webview
type MixxxaRPCSchema = {
	bun: {
		requests: {
			openFileDialog: {
				params: { allowedFileTypes?: string };
				response: string | null;
			};
			readFile: {
				params: { path: string };
				response: string;
			};
		};
		messages: Record<string, never>;
	};
	webview: {
		requests: Record<string, never>;
		messages: Record<string, never>;
	};
};

const rpc = BrowserView.defineRPC<MixxxaRPCSchema>({
	handlers: {
		requests: {
			openFileDialog: async ({ allowedFileTypes }) => {
				const paths = await Utils.openFileDialog({
					allowedFileTypes: allowedFileTypes ?? "xml",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: false,
				});
				return paths.length > 0 ? paths[0] : null;
			},
			readFile: async ({ path }) => {
				return await Bun.file(path).text();
			},
		},
		messages: {},
	},
});

// Check if Vite dev server is running for HMR
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

const url = await getMainViewUrl();

const _mainWindow = new BrowserWindow({
	title: "mixxxa",
	url,
	rpc,
	frame: {
		width: 1200,
		height: 800,
		x: 100,
		y: 100,
	},
});

console.log("mixxxa started!");
