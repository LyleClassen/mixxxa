import type { ElectrobunConfig } from "electrobun";

// ffmpeg-static ships a single binary matching the platform it was installed
// on; ffprobe-static ships all platforms and needs the arch-specific one
// picked out. Builds are per-host (see build.mac/linux/win below), so resolve
// against the current host — matches how the rest of the toolchain resolves.
const EXE = process.platform === "win32" ? ".exe" : "";
const FFMPEG_STATIC_BIN = `node_modules/ffmpeg-static/ffmpeg${EXE}`;
const FFPROBE_STATIC_BIN = `node_modules/ffprobe-static/bin/${process.platform}/${process.arch}/ffprobe${EXE}`;

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
			// Bun inlines ffmpeg-static/ffprobe-static's path string but does not
			// copy the binary into the bundle — place both next to the bun bundle
			// so binaries.ts's resolver (step 1: next-to-bundle) finds them.
			[FFMPEG_STATIC_BIN]: `bun/ffmpeg${EXE}`,
			[FFPROBE_STATIC_BIN]: `bun/ffprobe${EXE}`,
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
