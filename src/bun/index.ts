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
			getAudioServerPort: {
				params: Record<string, never>;
				response: number;
			};
		};
		messages: Record<string, never>;
	};
	webview: {
		requests: Record<string, never>;
		messages: Record<string, never>;
	};
};

const audioServer = Bun.serve({
	port: 0,
	fetch(req) {
		const filePath = new URL(req.url).searchParams.get("path");
		if (!filePath) return new Response("Missing path", { status: 400 });
		return new Response(Bun.file(filePath));
	},
});

const rpc = BrowserView.defineRPC<MixxxaRPCSchema>({
	maxRequestTime: Infinity,
	handlers: {
		requests: {
			openFileDialog: async ({ allowedFileTypes }) => {
				const paths = await Utils.openFileDialog({
					allowedFileTypes: allowedFileTypes ?? "xml",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: false,
				});
				const validPaths = paths.filter((p) => p.length > 0);
				return validPaths.length > 0 ? validPaths[0] : null;
			},
			getAudioServerPort: async () => audioServer.port,
			readFile: async ({ path }) => {
				const file = Bun.file(path);
				if (!(await file.exists())) {
					throw new Error(`File not found: ${path}`);
				}
				return await file.text();
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

void new BrowserWindow({
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
