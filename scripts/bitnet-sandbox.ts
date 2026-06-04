/**
 * BitNet sandbox.
 *
 * 0xbitnet is a WebGPU-only library — it runs the model on GPU compute shaders
 * via a `GPUDevice`. Bun has no WebGPU, and the native Dawn binding segfaults
 * under Bun on Windows (the crash happens the moment the binding loads), so this
 * must run under Node, where Dawn (the same WebGPU engine Chrome uses) works.
 *
 *   bun run sandbox:bitnet      (or: node scripts/bitnet-sandbox.ts)
 *
 * If launched with Bun, we re-exec the script under Node *before* touching the
 * native module, then mirror the upstream node-cli example: expose the WebGPU
 * enum globals, create a Dawn device with the adapter's max limits, and hand it
 * to BitNet.load. https://github.com/m96-chan/0xBitNet/tree/main/examples/node-cli
 */
export { };

// Guard: bail to Node before importing `webgpu` (importing it eagerly loads the
// Dawn binding, which segfaults under Bun). node:child_process is safe in Bun.
if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
    const { spawnSync } = await import("node:child_process");
    const { status } = spawnSync(
        "node",
        ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", process.argv[1]],
        { stdio: "inherit" }
    );
    process.exit(status ?? 1);
}

// Dynamic imports so the lines above run first under Bun.
const { create, globals } = await import("webgpu");
const { BitNet } = await import("0xbitnet");
const { readFile } = await import("node:fs/promises");
const { fileURLToPath, pathToFileURL } = await import("node:url");
const { join, dirname } = await import("node:path");

// Expose GPUBufferUsage / GPUMapMode / GPUShaderStage / GPUTextureUsage / ...
Object.assign(globalThis, globals);

// 0xbitnet loads the model with fetch(), which can't read file:// URLs in Node.
// Intercept file:// and serve the bytes from disk so no network download is needed.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("file://")) {
        const data = await readFile(fileURLToPath(url));
        return new Response(data, { headers: { "content-length": String(data.byteLength) } });
    }
    return realFetch(input, init);
}) as typeof fetch;

// Local model bundled under src/models (no download step).
const modelPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "models", "ggml-model-i2_s.gguf");
const MODEL_URL = pathToFileURL(modelPath).href;

const gpu = create([]);
const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
if (!adapter) throw new Error("No WebGPU adapter (check GPU drivers).");

// Raise limits so the model's large weight tensors fit in storage buffers.
const device = await adapter.requestDevice({
    requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage,
    },
});

const model = await BitNet.load(MODEL_URL, {
    device,
    onProgress: (p) => console.log(`${p.phase}: ${(p.fraction * 100).toFixed(1)}%`),
});

for await (const token of model.generate("What makes a good drum and bass dj playlist?")) {
    process.stdout.write(token);
}

model.dispose();

// Dawn keeps the event loop alive, so exit explicitly.
process.exit(0);
