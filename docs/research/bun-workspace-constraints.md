# Bun workspace constraints on patched and trusted dependencies

Research for [#39](https://github.com/LyleClassen/mixxxa/issues/39) (child of #38). Question: when this repo becomes a Bun workspace with the Electrobun app moved to `apps/mixxxa`, do the root-only manifest fields still work?

**Bun version under test: 1.3.14 (0d9b296a), Windows 11 x64.** Every "observed" claim below comes from a throwaway workspace built in the scratchpad and run against the real `rbox-js@0.1.7`, `@unimusic/chromaprint@0.1.4`, `ffmpeg-static` and `ffprobe-static` packages, plus a synthetic `file:` package used as a clean postinstall probe.

Each finding is tagged **[documented]** (stated in Bun's official docs) or **[observed]** (established by reproduction here, because the docs are silent or ambiguous).

---

## Headline: the premise of the question is partly wrong

The ticket asks where files land "under `bun install` in a workspace" assuming hoisting. **Bun 1.3.14 does not hoist a new workspace at all.** It defaults to the *isolated* (pnpm-style) linker, which produces a layout in which the root `node_modules` contains **no package directories whatsoever**.

This is the single most consequential finding, and it inverts the risk: the danger is not that `electrobun.config.ts`'s hardcoded `node_modules/...` paths break because files moved to the root — it is that they only work from `apps/mixxxa` as cwd, and silently break if anything runs the build from the repo root or if the linker is ever switched to `hoisted`.

---

## 1. `patchedDependencies`

### Does a root-declared patch apply to a member-declared dependency?

**Yes. [observed]**

Repro: root `package.json` declares `workspaces: ["apps/*"]` plus `patchedDependencies` for `rbox-js@0.1.7` and `@unimusic/chromaprint@0.1.4`; `apps/mixxxa/package.json` declares the dependencies. After `bun install`, the patched file in the store carries the patch marker:

```
node_modules/.bun/rbox-js@0.1.7/node_modules/rbox-js/index.js
  line 6: // Patched: removed `require = createRequire(__filename)` reassignment.
```

The `createRequire` reassignment the patch removes is absent. The patch applied.

This is the load-bearing case (without it the app crashes at startup with `Cannot find native binding`, per AGENTS.md), and it survives the move unchanged.

### May `patchedDependencies` live in a member's `package.json`?

**Yes — but the patch file path is resolved relative to the *workspace root*, not the member. [observed]**

The docs do not address workspaces at all under `bun patch` / `patchedDependencies` — they only state that the field lives "in `package.json`" and that patch files go in a `patches/` directory ([bun.sh/docs/install/patch](https://bun.sh/docs/install/patch)). So this was determined empirically.

Repro: root declares only `workspaces`; `apps/mixxxa/package.json` declares `patchedDependencies: { "rbox-js@0.1.7": "patches/rbox-js@0.1.7.patch" }` with the patch file at `apps/mixxxa/patches/`. Result:

```
error: Couldn't find patch file: 'patches/rbox-js@0.1.7.patch'
```

Bun clearly *read* the member's field — it knew to look for that exact patch — but resolved the path against the workspace root. Copying the same patch file to `<root>/patches/` and re-running, with the declaration still in the member, succeeded and the patch applied.

So a member-declared `patchedDependencies` works, but its paths point at the root. That is a foot-gun: the declaration and the file it names live in different packages.

### Recommendation

**Keep `patchedDependencies` and the `patches/` directory at the workspace root.** It is the only arrangement where the declaration and the file it references are co-located, it is proven to apply to member-declared dependencies, and it avoids the root-relative path trap. Moving the app to `apps/mixxxa` requires **no change** to this field.

---

## 2. `trustedDependencies`

### Do postinstalls fire for member-declared dependencies, and must the allowlist be at root?

**Postinstalls fire. The allowlist works from either root or member. [observed]**

The docs describe `trustedDependencies` and the default-allowlist semantics ([bun.sh/docs/install/lifecycle](https://bun.sh/docs/install/lifecycle)) but say nothing about workspaces.

`ffmpeg-static` is a poor probe because it is in [Bun's built-in default trusted list](https://github.com/oven-sh/bun/blob/main/src/install/default-trusted-dependencies.txt) — a control run with no `trustedDependencies` anywhere still ran its postinstall and downloaded `ffmpeg.exe`. So the scope test used a synthetic `file:` dependency instead, which the docs state is **never** covered by the default list:

> "The default trusted dependencies list only applies to packages installed from npm. For packages from other sources (such as `file:`, `link:`, `git:`, or `github:` dependencies), you must explicitly add them to `trustedDependencies`…" — [bun.sh/docs/install/lifecycle](https://bun.sh/docs/install/lifecycle) **[documented]**

The probe package's postinstall writes a marker file. Dependency always declared by the member. Results:

| Variant | `trustedDependencies` location | Postinstall |
|---|---|---|
| D1 | workspace **root** | **ran** |
| D2 | **member** (`apps/mixxxa`) | **ran** |
| D3 | nowhere (control) | **blocked** |

Both placements work; absence blocks, confirming the probe is sensitive.

### The real hazard is the default-list replacement rule, not workspaces

Declaring the field **replaces** Bun's default list rather than extending it **[documented]**. Checked against the current default list:

| Package | In Bun's default trusted list? |
|---|---|
| `ffmpeg-static` | yes |
| `ffprobe-static` | **no** |
| `webgpu` | **no** |
| `@kmamal/gpu` | **no** |

Three of the repo's four entries are *only* trusted because they are listed explicitly. The existing allowlist is therefore load-bearing and must be carried over verbatim — dropping it would silently break `ffprobe-static`, `webgpu` and `@kmamal/gpu`.

### Recommendation

**Keep `trustedDependencies` at the workspace root, verbatim, all four entries.** Root placement is proven to work for member-declared dependencies, keeps one allowlist for the whole repo, and avoids the situation where two members declare divergent allowlists for the same package. No change needed on the move.

---

## 3. Hoisting and the Electrobun asset-copy paths

### Isolated is the default for new workspaces

> "Isolated installs are the default for **new** workspace/monorepo projects (with `configVersion = 1` in the lockfile). Existing projects continue using hoisted installs unless explicitly configured." — [bun.sh/docs/install/isolated](https://bun.sh/docs/install/isolated) **[documented]**

| `configVersion` | Workspaces? | Default linker |
|---|---|---|
| `1` | yes | **isolated** |
| `1` | no | hoisted |
| `0` | either | hoisted |

Confirmed **[observed]**: the repro's generated `bun.lock` contains `"lockfileVersion": 1, "configVersion": 1`, and the resulting layout was isolated with no linker configured anywhere.

### Where files actually land — isolated **[observed]**

Root `node_modules` contains **only** `.bun`. No package directories, not even symlinks:

```
node_modules/
└── .bun/
    ├── node_modules/                    # hoisted fallback, real dirs
    ├── ffmpeg-static@5.3.0/node_modules/ffmpeg-static/
    ├── ffprobe-static@3.1.0/node_modules/ffprobe-static/
    ├── rbox-js@0.1.7/node_modules/rbox-js/
    ├── @dylanljones+rbox-js-win32-x64-msvc@0.1.7/…   # the native binding
    └── @unimusic+chromaprint@0.1.4/node_modules/@unimusic/chromaprint/
```

`apps/mixxxa/node_modules/` holds **symlinks** into that store (`ffmpeg-static -> …/.bun/ffmpeg-static@5.3.0/node_modules/ffmpeg-static`), plus a real directory for the scoped `@unimusic`.

The three paths `electrobun.config.ts` hardcodes resolve as follows:

| cwd | `node_modules/ffmpeg-static/ffmpeg.exe` | `node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe` | `node_modules/@unimusic/chromaprint/dist/chromaprint.wasm` |
|---|---|---|---|
| repo root | **not found** | **not found** | **not found** |
| `apps/mixxxa` | found | found | found |

### Where files land — hoisted, for contrast **[observed]**

With `bunfig.toml` forcing `linker = "hoisted"`, the layout inverts completely: every package sits in root `node_modules/` as a real directory, `apps/mixxxa/node_modules/` **does not exist at all**, and the same three relative paths resolve from the repo root but **not** from `apps/mixxxa`.

The patch still applied correctly under the hoisted linker too, so patching is linker-independent.

### Is hoisting guaranteed? No — it is conditional on version conflicts **[observed]**

Under the hoisted linker, a second member declaring `debug@2.6.9` while `apps/mixxxa` declared `debug@4.4.3` produced:

- root `node_modules/debug` → 4.4.3 (the winner, hoisted)
- `apps/other/node_modules/debug` → nested copy for the loser

So even under hoisting, a package's physical location depends on whether any other member requests a conflicting version. A hardcoded `node_modules/<pkg>/…` path is only correct for whichever version happened to win hoisting — it is never a guarantee.

### Why this is dangerous rather than merely brittle

`electrobun.config.ts` resolves copy sources against `process.cwd()`. Confirmed in Electrobun 1.18.1's CLI source (`node_modules/electrobun/src/cli/index.ts`):

```ts
const projectRoot = process.cwd();          // line 63
…
for (const relSource in config.build.copy) {
  const source = join(projectRoot, relSource);
  if (!existsSync(source)) {
    console.error(`failed to copy ${source} because it doesn't exist.`);
    continue;                                // ← does NOT fail the build
  }
```

A missing source prints to stderr and **continues**. The build still "succeeds" and emits an app bundle missing `ffmpeg`, `ffprobe`, or `chromaprint.wasm` — a runtime failure discovered only when a user runs the packaged app. There is no non-zero exit to catch this in CI.

Under the isolated default the current relative paths *do* work, provided the build is always run with cwd = `apps/mixxxa` (which `bun run --filter` and a `cd apps/mixxxa && electrobun build` both satisfy). But the correctness of a shipped installer then rests on an undocumented coincidence between the linker mode and the cwd.

### The robust alternative: `require.resolve` **[observed]**

`require.resolve` resolves through the symlink to the real store path, and is correct under **both** linkers and regardless of cwd, hoisting, or version conflicts. From `apps/mixxxa` under the isolated linker:

```
require.resolve("ffmpeg-static")
  → …/node_modules/.bun/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/index.js

require("ffmpeg-static")                     // ffmpeg-static's own export
  → …/node_modules/.bun/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe

path.dirname(require.resolve("ffprobe-static"))
  → …/node_modules/.bun/ffprobe-static@3.1.0/node_modules/ffprobe-static
```

`import.meta.resolve` also works, returning a `file://` URL (so it needs `fileURLToPath`); `require.resolve` returning a plain path is the more convenient of the two here.

Note `require.resolve` targets a package's **entry point**, not its root, so derive the package directory via `path.dirname(...)` (for a root-level entry) and join the asset path onto that. For `ffmpeg-static` specifically the package already exports the binary path directly, which is better still.

### Recommendation

**Replace the three hardcoded `node_modules/...` strings in `electrobun.config.ts` with `require.resolve`-derived absolute paths**, as part of the workspace move rather than after it. Concretely:

- `ffmpeg-static` → use its default export (`require("ffmpeg-static")`), which already is the absolute binary path.
- `ffprobe-static` → `path.dirname(require.resolve("ffprobe-static"))` + `bin/<platform>/<arch>/ffprobe<EXE>`.
- `@unimusic/chromaprint` → resolve the package and join `chromaprint.wasm` next to its resolved `dist/` entry.

Electrobun's `copy` keys are joined onto `process.cwd()`, and `join` with an absolute second argument returns that absolute path, so absolute sources pass through unchanged.

Additionally, **do not rely on Electrobun's own error handling** — add an explicit `existsSync` assertion that throws for each of the three sources, so a missing binary fails the build loudly instead of shipping a broken bundle.

Finally, **do not set `linker = "hoisted"`** to "fix" the paths. It would restore the old relative paths for a root-cwd build but breaks them for a member-cwd build, and remains vulnerable to version-conflict nesting. Resolve properly instead.

---

## Summary table

| Question | Answer | Action on the move |
|---|---|---|
| `patchedDependencies` must live at root? | Works at root **and** in a member, but member declarations resolve patch paths against the root | Keep at root, unchanged |
| Root patch applies to member-declared dep? | **Yes**, verified with the load-bearing `rbox-js` patch | None |
| `trustedDependencies` postinstalls fire for member deps? | **Yes**, from root or member placement | Keep at root, all 4 entries verbatim |
| Where do files land? | Isolated linker by default: `node_modules/.bun/<pkg>@<ver>/…` with symlinks in `apps/mixxxa/node_modules`; root has **no** packages | Rewrite the 3 hardcoded paths |
| Is hoisting guaranteed? | No — not the default for new workspaces at all, and even under `hoisted` it is conditional on version conflicts | Never depend on it |
| Robust alternative? | `require.resolve` (or `import.meta.resolve`), correct under both linkers | Adopt |

## Sources

**Primary documentation**
- [bun.sh/docs/install/workspaces](https://bun.sh/docs/install/workspaces) — workspace globs, `workspace:` protocol, hoisting language, `installConfig.hoistingLimits`
- [bun.sh/docs/install/isolated](https://bun.sh/docs/install/isolated) — isolated linker, the `configVersion` default table, store layout
- [bun.sh/docs/install/lifecycle](https://bun.sh/docs/install/lifecycle) — `trustedDependencies`, default-list replacement semantics, the `file:`/`git:` carve-out
- [bun.sh/docs/install/patch](https://bun.sh/docs/install/patch) — `bun patch`, `patchedDependencies` (silent on workspaces)
- [oven-sh/bun `src/install/default-trusted-dependencies.txt`](https://github.com/oven-sh/bun/blob/main/src/install/default-trusted-dependencies.txt) — 367 entries; checked membership for all four repo entries

**Source read**
- `node_modules/electrobun/src/cli/index.ts` (Electrobun 1.18.1) — `projectRoot = process.cwd()` (line 63) and the `build.copy` loop (~line 3288)

**Reproductions** (Bun 1.3.14, Windows 11 x64, throwaway workspaces in the session scratchpad; not committed)
- root-declared patches + trusted deps, member-declared dependencies — isolated layout, patch applied, postinstalls ran
- member-declared `patchedDependencies` — patch path resolved against workspace root
- `file:` postinstall probe × {root allowlist, member allowlist, no allowlist}
- `linker = "hoisted"` variant with a deliberate `debug` version conflict across two members
- `require.resolve` / `import.meta.resolve` under the isolated linker
