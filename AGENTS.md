# AGENTS.md

Notes for AI coding agents working in this repository. Keep this short and
high-signal — drop anything that becomes obvious from the code.

## Stack

- **Runtime/bundler:** Bun (CJS+ESM mixed). The bun-process entry is
  bundled by `electrobun dev` / `electrobun build`, which calls
  `Bun.build` internally — see [node_modules/electrobun/src/cli/index.ts](node_modules/electrobun/src/cli/index.ts).
- **Desktop shell:** Electrobun (uses WebView2 on Windows).
- **View layer:** React 18 + Tailwind v4 + Vite 6 (HMR via dev server on
  `:5173`).
- **Native module:** `rbox-js` (NAPI-RS, Rust) for Rekordbox DB access.

## Dev workflows

- `bun run dev` — Electrobun watch mode, no Vite HMR (uses bundled assets).
- `bun run dev:hmr` — runs Vite (`:5173`) and Electrobun concurrently. The
  bun process detects the dev server in [src/bun/index.ts](src/bun/index.ts)
  and points the WebView at it.
- `bun run start` — one-shot `vite build && electrobun dev`.

## Patched dependencies — `rbox-js`

`rbox-js@0.1.7`'s NAPI-RS loader does:

```js
const { createRequire } = require('node:module')
require = createRequire(__filename)
```

Bun's bundler hoists the bare `require` to the bundle-wide `__require` and
treats the assignment as a global mutation. After the loader runs, every
subsequent `__require("./...")` in the bundle resolves relative to
`node_modules/rbox-js/` instead of the bundle, so the hashed native
binding (`rbox-js.win32-x64-msvc-<hash>.node`) sitting next to the
bundle can't be found. Symptom: app crashes at startup with
`Cannot find native binding. npm has a bug related to optional
dependencies...`.

Fix lives in [patches/rbox-js@0.1.7.patch](patches/rbox-js@0.1.7.patch),
applied automatically via `patchedDependencies` in
[package.json](package.json). The patch deletes the two lines above —
they are a no-op in CJS (the module-local `require` parameter is
already correct).

**Bumping `rbox-js`:**

1. Update version in `package.json`, run `bun install`. The patch will
   fail to apply cleanly.
2. `bun patch rbox-js`
3. Edit `node_modules/rbox-js/index.js`, delete the `const { createRequire } …`
   and `require = createRequire(__filename)` lines.
4. `bun patch --commit 'node_modules/rbox-js'`
5. Verify with `bun run dev:hmr` — no `Cannot find native binding` error.

If upstream drops the reassignment (or Bun fixes the hoisting), delete
the patch and the `patchedDependencies` entry.

## Build output layout

Electrobun produces a per-platform bundle under
`build/dev-<platform>-<arch>/<app-name>-dev/`:

- `bin/launcher.exe` — entry binary. Running this directly skips the
  `electrobun dev` rebuild step and is useful for testing a patched
  bundle in place.
- `Resources/app/bun/index.js` — bundled bun-process code. Native
  `.node` files are copied next to it with a content hash suffix.
- `Resources/app/views/mainview/` — Vite build output (only used when
  HMR is off).

## Gotchas

- The Vite dev server is plain HTTP on `:5173`; the bun process probes
  it with `fetch(..., { method: 'HEAD' })` and falls back to bundled
  assets if it isn't up. Don't expect HMR to "just work" if Vite hasn't
  started yet.
- `electrobun dev` re-bundles `src/bun/**` on every restart, so any
  manual edits to `Resources/app/bun/index.js` are wiped. Test fixes by
  running `build/.../bin/launcher.exe` directly if you need to bypass
  the rebuild.
- Bun's bundler inlines static-unresolvable relative requires as
  `(() => { throw new Error("Cannot require module …") })()`. When you
  see those in bundled output, they are expected fallback branches, not
  necessarily the actual failure — look at what catches the throw.
