# AGENTS.md

Notes for AI coding agents working in this repository. Keep this short and
high-signal — drop anything that becomes obvious from the code.

See [CONTEXT.md](CONTEXT.md) for the project's glossary — the agreed word for
each domain concept, and the words we've decided not to use.

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

## Audio analysis assets

### 1. `ffmpeg` binary

`ffmpeg-static` is listed as an npm dependency and ships a platform `ffmpeg` binary at:
```
node_modules/ffmpeg-static/ffmpeg.exe  (Windows)
node_modules/ffmpeg-static/ffmpeg      (Mac/Linux)
```
`src/bun/analysis/decoder.ts` imports the path via `import ffmpegPath from 'ffmpeg-static'`.

**Electrobun bundling caveat:** The Bun bundler inlines `ffmpeg-static`'s path string, but does NOT copy the binary into the app bundle. When building for distribution (`bun run build:canary`) you must arrange to ship the binary alongside the bundle (e.g., copy to `Resources/app/bun/ffmpeg.exe`) and adjust the path resolution in `decoder.ts`. During development (`bun run dev:hmr`) the path in `node_modules/` works as-is.

### 2. Analysis engines

Two analysis engines are selectable in Settings:

**Essentia (default):** Key + BPM via Essentia.js (WASM) in renderer workers.
Audio decoded to 44.1 kHz mono PCM in Bun and served over `GET /pcm/{itemId}`.

**ORBIT (Python/librosa):** Runs entirely Bun-side via a Python sidecar process.
Produces Key, BPM, Energy, Loudness (dBFS), Dynamic Range, and Danceability in
one `analyzeOrbit()` call — structurally identical to the bitrate ffprobe path
(completes without ever claiming a renderer worker). Key + mode from ORBIT are
normalized to Camelot notation via the shared `src/shared/camelot.ts` map.

### 3. ORBIT Python sidecar

Location: `sidecar/` (uv project, `orbit-dsp==1.0.1`).

**Dev workflow:**
1. `bun run setup:python` — installs the Python venv via `uv sync`.
2. Sidecar auto-starts on first ORBIT analysis request (`src/bun/analysis/sidecar.ts`).
   Process is kept warm between requests (librosa startup ~2s paid once).
3. Manual test: pipe `{"id":"1","filePath":"<some.mp3>","maxLength":120}\n`
   to `uv run python sidecar/main.py` and confirm one id-correlated JSON result.

**Build for distribution:**
1. `bun run build:sidecar` — runs PyInstaller via `sidecar/build.spec`.
   Output: `sidecar/dist/orbit-sidecar[.exe]` (~200–400 MB).
2. Copy the exe to `Resources/app/bun/orbit-sidecar[.exe]` before packaging.
   `sidecar.ts` checks for the exe next to the bundle; falls back to `uv run` in dev.

**Windows note:** Windows wheels exist for librosa/numpy/scipy (unlike essentia),
so the frozen binary is viable on Windows.

**PyInstaller note:** `sidecar/build.spec` uses `collect_all()` for librosa, numba,
sklearn, and scipy to capture data files that PyInstaller misses otherwise.
Test the frozen exe standalone before wiring into the full app build.

## Rekordbox write-back

Mixxxa mirrors Rekordbox into a local SQLite db and can write changes back to
`master.db` (see the `rekordbox-write-back` capability). Two rules when touching
this area:

- **Any new Mixxxa-side edit to a Rekordbox-mirrored field must be wired into
  write-back.** If you let users change something that exists in Rekordbox —
  track titles, comments, ratings, colors, key, BPM, playlist ordering, etc. —
  it must show up in the write-back diff and be applied via the appropriate
  `rbox-js` write API (`updateContent`, `updateContentKey`, `movePlaylistSong`,
  …). Don't add an editable mirrored field that silently can't be synced back.
- **Writes are guarded and reversible.** Never write while Rekordbox is running
  (`isRekordboxRunning()`), always create a timestamped backup before
  overwriting `master.db`, and don't use `setUnsafeWrites(true)`.

## Long-running processes need progress

Any potentially long-running operation (record-by-record write-back, analysis,
backup/restore of large files, etc.) MUST report progress to the user rather
than appearing frozen. Use the existing broadcast pattern — `rpc.send.<name>(…)`
from the bun process (see `autoCueProgress`/`analysisQueueUpdate` in
[src/bun/index.ts](src/bun/index.ts)) — and render a determinate indicator in
the view.

## Workspace packages

> Describes the layout that [#44](https://github.com/LyleClassen/mixxxa/issues/44)
> puts in place. Until that lands, the repo is still single-package and
> `packages/` does not exist. Convention settled in
> [#41](https://github.com/LyleClassen/mixxxa/issues/41).

`apps/` holds the Electrobun app. `packages/` holds everything else,
whatever language it is written in — the Python sidecar included. Every
member under `packages/` is scoped `@mixxxa/<name>`, so the workspace
name and the published name are the same string and nothing gets renamed
on the day something first ships.

### Names

Three tiers, and only the third is scoped. The root manifest is
`mixxxa-workspace`, `"private": true` — orchestration only, never
published and never imported. The app is `mixxxa`, unscoped, because it
is the product rather than a candidate for npm. Packages are
`@mixxxa/<name>`. Settled in
[#42](https://github.com/LyleClassen/mixxxa/issues/42).

The root declares **no ordinary dependencies**. Everything the app
imports is declared by the app; the root manifest carries only
`workspaces`, `patchedDependencies`, `trustedDependencies` and
orchestration scripts. A root devDependency that nothing at the root
imports is the phantom dependency the isolated linker exists to prevent.

Two kinds of member live under `packages/`, and the only structural
difference between them is the `private` field:

- **Internal package** — `"private": true`. Exists to organise the repo.
  `@mixxxa/sidecar` is the only one today.
- **Publishable package** — no `private` field. Goes to npm.

### Adding a publishable package

Same `packages/*` glob as an internal one; do not invent a second
directory for "the ones that ship". A package that changes status should
change one field, not move.

Its `package.json` needs, beyond the usual:

```jsonc
{
  "name": "@mixxxa/<name>",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "publishConfig": { "access": "public" },
  "scripts": { "build": "tsc -p tsconfig.json" }
}
```

`publishConfig.access` is load-bearing: scoped packages default to
restricted, and npm rejects the publish rather than warning.

It also needs **its own standalone `tsconfig.json` — no `extends`**. The
root config is the app's config that happens to sit at the root, not a
shared base: it sets `noEmit`, turns on `allowImportingTsExtensions`
(which TypeScript refuses alongside emit), pulls in DOM libs and
`react-jsx`, and defines a `@/*` alias into the app's view layer that a
package must never use. So set `noEmit: false`, `declaration: true` and
`outDir: "dist"` in a config of its own. If a genuine shared base is ever
wanted, that is a `tsconfig.base.json`, and nobody needs one yet.

**Publishing TypeScript source directly is not the convention.** It works
only while every consumer is Bun, which is exactly the assumption a
package leaving this repo stops being able to make.

### Dependency direction

One way. `apps/mixxxa` may depend on any package; **no package may ever
depend on `apps/mixxxa`**. A published package that imports from the app
is unpublishable by construction. Package-to-package dependencies are
fine — that is what the workspace is for.

Nothing enforces this. There is no CI in this repo, and a check script
with nothing to run it is decoration. With one app and one package the
rule is hard to break by accident; revisit if either number grows.

### The `@mixxxa` scope is unverified

Nobody has registered the `mixxxa` org on npm, and registering it was
deliberately not done. Whoever publishes first must check the scope is
still available and pick a fallback if it is gone. The internal packages
do not care either way, since a private package's name never reaches the
registry.

### Deliberately deferred

Considered and left until there is something real to publish, not
forgotten:

- **Changesets**, and any versioning policy at all.
- **npm auth** — no token, no org, no `.npmrc`.
- **A release job** — there is no CI to hang one off.

## Agent skills

### Issue tracker

GitHub Issues (`gh` CLI), inferred from the `origin` remote. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

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
