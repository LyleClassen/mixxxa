import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The `electrobun` npm package is a bootstrap for the Hutch CLI, not the SDK —
// every one of its exports throws. Hutch aliases the main process onto
// .hutch/devkit itself, but Vite is a separate build step and would happily
// compile that throw into the view bundle with a green exit code. Alias the
// browser-side entries explicitly so the renderer gets the real SDK.
const devkit = path.resolve(__dirname, ".hutch/devkit");

export default defineConfig({
	plugins: [react(), tailwindcss()],
	root: "src/mainview",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src/mainview"),
			"electrobun/view": path.join(devkit, "api/browser/index.ts"),
			"electrobun/browser/ui": path.join(devkit, "api/browser/ui/index.ts"),
		},
	},
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	worker: {
		format: "es",
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
