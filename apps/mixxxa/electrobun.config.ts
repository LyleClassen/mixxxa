import { createRequire } from "node:module";
import path from "node:path";
import type { ElectrobunConfig } from "electrobun";

const require = createRequire(import.meta.url);

// Electrobun re-joins every build.copy key onto projectRoot (process.cwd()),
// so the keys MUST be relative — an absolute key concatenates into nonsense and
// the copy loop only console.errors and continues, shipping an installer with a
// missing binary and a zero exit code. Resolve, then relativise against cwd.
const rel = (absolute: string) => path.relative(process.cwd(), absolute);

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
// Absent in a fresh checkout, which costs one `failed to copy` line per
// `electrobun dev` run — deliberately preferred to a conditional key, which
// would turn a noisy dev case into a silent release one.
const sidecarExe = path.resolve(
	import.meta.dir,
	"../../packages/sidecar/dist",
	`orbit-sidecar${EXE}`,
);

export default {
	app: {
		name: "mixxxa",
		// Not renamed with app.name: it drives Utils.paths.userData, so changing
		// it abandons the existing library in place. Out of scope on issue #38.
		identifier: "reacttailwindvite.electrobun.dev",
		version: "0.0.1",
	},
	build: {
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
			[rel(sidecarExe)]: `bun/orbit-sidecar${EXE}`,
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
