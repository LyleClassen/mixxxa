import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "react-tailwind-vite",
		identifier: "reacttailwindvite.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			// Must sit next to the bun bundle: Emscripten can't fetch file://
			// under Bun, so src/bun/analysis/fingerprint.ts reads it manually
			"node_modules/@unimusic/chromaprint/dist/chromaprint.wasm":
				"bun/chromaprint.wasm",
		},
		// Ignore Vite build output in watch mode
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
