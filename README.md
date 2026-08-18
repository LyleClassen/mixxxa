# React + Tailwind + Vite Electrobun Template

A fast Electrobun desktop app template with React, Tailwind CSS, and Vite for hot module replacement (HMR).

## Getting Started

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr

# Build for production
bun run build

# Build for production release
bun run build:prod
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## Project Structure

```
├── src/
│   ├── bun/
│   │   └── index.ts        # Main process (Electrobun/Bun)
│   └── mainview/
│       ├── App.tsx         # React app component
│       ├── main.tsx        # React entry point
│       ├── index.html      # HTML template
│       └── index.css       # Tailwind CSS
├── electrobun.config.ts    # Electrobun configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## Customizing

- **React components**: Edit files in `src/mainview/`
- **Tailwind theme**: Edit `tailwind.config.js`
- **Vite settings**: Edit `vite.config.ts`
- **Window settings**: Edit `src/bun/index.ts`
- **App metadata**: Edit `electrobun.config.ts`

## Patched dependencies

### `rbox-js`

`rbox-js@0.1.7` ships an auto-generated NAPI-RS loader that does
`require = createRequire(__filename)` at the top of `index.js`. Bun's
bundler hoists that bare `require` to the bundle-wide `__require` and
treats the assignment as a global mutation, which breaks the bundled
native-binding lookup (the `.node` file gets a hashed filename next to
the bundle, but the rebound `__require` resolves relative to
`node_modules/rbox-js/` instead). The result is a runtime
`Cannot find native binding` error when launching the app.

The patch in `patches/rbox-js@0.1.7.patch` removes the unnecessary
reassignment (`require` is already module-local in CJS). It is applied
automatically via `patchedDependencies` in `package.json`.

**Bumping `rbox-js`:**

1. Update the version in `package.json` and run `bun install` — the
   install will warn that the patch no longer applies cleanly.
2. Re-prepare the patch:
   ```bash
   bun patch rbox-js
   ```
3. Edit `node_modules/rbox-js/index.js` and remove the two lines:
   ```js
   const { createRequire } = require('node:module')
   require = createRequire(__filename)
   ```
4. Commit the new patch:
   ```bash
   bun patch --commit 'node_modules/rbox-js'
   ```
5. Verify by running `bun run dev:hmr` — the app should start without a
   `Cannot find native binding` error.

If upstream rbox-js drops the `require =` reassignment (or Bun fixes
the hoisting behavior), the patch can be removed entirely.
