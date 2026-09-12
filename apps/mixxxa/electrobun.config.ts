import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { ElectrobunConfig } from "electrobun";

const require = createRequire(import.meta.url);

// Electrobun 2.x joins every build.copy key onto the *project root* — the
// directory holding this config — not process.cwd(), which during config
// evaluation is a .cottontail-tmp scratch dir five levels down. So the keys
// MUST be relative to import.meta.dir. Resolve, then relativise.
const rel = (absolute: string) => path.relative(import.meta.dir, absolute);

// The static packages' physical location depends on the linker mode and on the
// resolved version, so nothing here may be hardcoded as node_modules/... .
const EXE = process.platform === "win32" ? ".exe" : "";

// ffmpeg-static's default export already is the absolute binary path.
const ffmpegBin: string = require("ffmpeg-static");
// ffprobe-static ships every platform; pick the arch-specific one. Builds are
// per-host, so resolve against the current host.
const ffprobeBin = path.join(
	path.dirname(require.resolve("ffprobe-static")),
	"bin",
	process.platform,
	process.arch,
	`ffprobe${EXE}`,
);
// Must sit next to the bun bundle: Emscripten can't fetch file:// under Bun,
// so src/bun/analysis/fingerprint.ts reads it manually.
const chromaprintWasm = path.join(
	path.dirname(require.resolve("@unimusic/chromaprint")),
	"chromaprint.wasm",
);
// The frozen sidecar, built by `bun run build:sidecar` at the workspace root.
const sidecarExe = path.resolve(
	import.meta.dir,
	"../../packages/sidecar/dist",
	`orbit-sidecar${EXE}`,
);

// v2 hard-fails the build with CopySourceMissing on an absent copy source, so
// the dev channel omits the sidecar rather than making a fresh checkout
// unbuildable. Canary and stable always demand it: a release with no sidecar
// must fail loud, which is exactly what 1.18.1's silent console.error did not.
const buildEnv = process.env.ELECTROBUN_BUILD_ENV ?? "dev";
const includeSidecar = buildEnv !== "dev" || existsSync(sidecarExe);

export default {
	app: {
		name: "mixxxa",
		// Not renamed with app.name: it drives Utils.paths.userData, so changing
		// it abandons the existing library in place. Out of scope on issue #38.
		identifier: "reacttailwindvite.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		// v2 defaults to "cottontail". The main process uses bun:ffi, the rbox-js
		// NAPI binding, and spawns ffmpeg and the Python sidecar — Cottontail is a
		// separate evaluation, not part of the v2 upgrade.
		mainProcess: "bun",
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			[rel(chromaprintWasm)]: "bun/chromaprint.wasm",
			// Bun inlines ffmpeg-static/ffprobe-static's path string but does not
			// copy the binary into the bundle — place both next to the bun bundle
			// so binaries.ts's resolver (step 1: next-to-bundle) finds them.
			[rel(ffmpegBin)]: `bun/ffmpeg${EXE}`,
			[rel(ffprobeBin)]: `bun/ffprobe${EXE}`,
			...(includeSidecar
				? { [rel(sidecarExe)]: `bun/orbit-sidecar${EXE}` }
				: {}),
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
