# Drizzle ORM + `bun:sqlite` compatibility, and migrations inside a packaged Electrobun app

Research output for [#50](https://github.com/LyleClassen/mixxxa/issues/50) (map: [#49](https://github.com/LyleClassen/mixxxa/issues/49)).
Date: 2026-09-12. All claims cite the primary source read to establish them (drizzle-orm source on
GitHub, Drizzle/Bun docs, or real repos found via GitHub code search).

## TL;DR

**Yes, with caveats.** `drizzle-orm/bun-sqlite` wraps `bun:sqlite`'s native `Database` directly —
`drizzle({ client: sqlite })` takes an already-open `Database` instance, so Mixxxa's existing
`getDb()` (WAL pragma, etc.) keeps working unchanged and Drizzle sits on top of it
([driver.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/driver.ts)).
Prepared statements, `.transaction()` (native `client.transaction()` under the hood, with
savepoints for nested transactions), and raw SQL (`sql\`...\`` / `db.run()` / `db.all()`) are all
first-class — nothing in `localDb.ts`'s usage pattern is incompatible.

The one real caveat is **not the ORM, it's drizzle-kit**: the `drizzle-kit` CLI's own DB connector
does not talk to `bun:sqlite` for anything that needs a *live* connection (`push`, `pull`,
`studio`, and the CLI's own `migrate` command) — it demands `better-sqlite3` or `@libsql/client`
be installed, even in a 100%-Bun project
([drizzle-orm#3423](https://github.com/drizzle-team/drizzle-orm/issues/3423),
[#4350](https://github.com/drizzle-team/drizzle-orm/issues/4350),
[#1520](https://github.com/drizzle-team/drizzle-orm/issues/1520), all open as of this writing).
This doesn't block Mixxxa: `drizzle-kit generate` (schema-diff → SQL files, no live DB) is
driver-agnostic and works fine; only `drizzle-kit migrate` (the CLI command) is affected, and
Mixxxa was never going to use that — see below.

**Recommended packaged-app migration architecture:** generate migrations at build time with
`drizzle-kit generate` (dev-only CLI, never ships), then **embed the generated SQL as JS/TS
string literals at bundle time** (Bun text-import or a small generated `migrations.ts`) and
apply them at runtime by calling `db.dialect.migrate(migrations, db.session, config)` directly —
the same lower-level primitive every per-driver `migrate()` wrapper calls — instead of going
through `drizzle-orm/bun-sqlite/migrator`'s exported `migrate()`, which insists on reading
`.sql` files and `meta/_journal.json` off disk via `node:fs` at runtime. This sidesteps packaged
bundle path-resolution entirely; no `build.copy` entries for a migrations folder are needed. This
is not a novel idea — it is the exact pattern the `expo-sqlite` driver bakes in as its supported
API, and the exact pattern a real Bun desktop app (`opencode`/`kilocode`) uses in production. Both
are cited in detail below.

## 1. Driver compatibility (question 1)

### 1.1 How `drizzle-orm/bun-sqlite` attaches to an existing `bun:sqlite` `Database`

Reading [`drizzle-orm/src/bun-sqlite/driver.ts`](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/driver.ts)
(current `main`, fetched via `gh api` on 2026-09-12) directly:

```ts
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database('sqlite.db');   // exactly what localDb.ts already does
const db = drizzle({ client: sqlite });
```

`drizzle()`'s `construct()` function takes the passed-in `Database` as `client`, builds a
`SQLiteBunSession` around it, and stores the original client at `db.$client` for raw
fall-through access. Critically, **`drizzle()` never opens the database itself when you pass
`client`** — it only calls `new Database(...)` internally if you pass a path/string or nothing.
That means Mixxxa's `getDb()` can keep doing `new Database(dbPath)` + `db.exec("PRAGMA
journal_mode=WAL;")` exactly as today, then hand that same instance to `drizzle({ client: db
})` — no behavioral change to connection opening, WAL setup, or the singleton pattern.

### 1.2 Prepared statements / `.transaction()` / sync query patterns

Reading [`drizzle-orm/src/bun-sqlite/session.ts`](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/session.ts) (same fetch):

- `prepareQuery()` calls `this.client.prepare(query.sql)` — Drizzle prepares every query through
  `bun:sqlite`'s own `.prepare()`, not a reimplementation. `.run()` / `.all()` / `.values()` on the
  resulting `PreparedQuery` delegate straight to the underlying `Statement`'s `.run()` / `.all()`
  / `.values()`.
- `transaction()` wraps the user callback in **`this.client.transaction(() => {...})`** — i.e. it
  calls `bun:sqlite`'s own native `.transaction()`, then invokes `nativeTx[config.behavior ??
  'deferred']()`. This is the *exact* pattern `localDb.ts` already uses by hand
  (`database.transaction(() => {...})()`), just wrapped.
- Nested Drizzle transactions become SQL `SAVEPOINT`s (`SQLiteBunTransaction.transaction()`),
  matching SQLite's own nesting model — same semantics Mixxxa would get doing it manually.
- Everything is fully synchronous (`BaseSQLiteDatabase<'sync', ...>`), matching `bun:sqlite`'s
  sync-only API — there's no accidental async/Promise wrapping to trip over.

No incompatibility found between how Drizzle drives `bun:sqlite` and how `localDb.ts` already
drives it by hand — Drizzle is a thin, faithful layer over the same native calls.

### 1.3 `better-sqlite3` vs `bun:sqlite` differences that matter here

- Bun's own docs state `bun:sqlite` is "credited to `better-sqlite3` for API inspiration" and
  benchmarks it at **~3–6x faster than `better-sqlite3`** for reads
  ([bun.com/docs/api/sqlite](https://bun.com/docs/api/sqlite)) — a performance upgrade, not a
  behavioral downgrade, but it means any perf assumptions carried over from `better-sqlite3`
  Drizzle examples online don't transfer 1:1.
- **`drizzle-orm/better-sqlite3` and `drizzle-orm/bun-sqlite` are separate driver packages** with
  separate `migrator.ts` files (confirmed via `git/trees` listing of `drizzle-orm/src/`) — they
  are not interchangeable at the import level, so any code/StackOverflow answer written against
  `drizzle-orm/better-sqlite3` needs its imports swapped, even though the query-builder surface
  above the driver layer is identical.
- One older, closed bug (`drizzle-orm#1153`, bun 0.8.1 era) showed `.returning()` failing under
  `bun:sqlite` with a "near returning: syntax error" — a bug in an ancient bundled SQLite version,
  not present in current Bun (1.3.14 statically links a modern SQLite). Flagged for completeness,
  not a live concern.
- WAL sidecar-file (`-wal`/`-shm`) persistence-after-close differs by platform per Bun's own docs:
  macOS's system SQLite build persists them past `.close()`, Linux/Windows (where Bun statically
  links vanilla SQLite) generally don't. Not a Drizzle-specific issue — applies identically to
  Mixxxa's current hand-written `bun:sqlite` usage — but worth carrying into the schema-redesign
  plan since it affects how "did the DB file actually change" checks should behave cross-platform.

## 2. Packaged-app migration mechanics (question 2) — the meaty part

### 2.1 What `drizzle-orm/bun-sqlite/migrator`'s `migrate()` actually does

Reading [`drizzle-orm/src/bun-sqlite/migrator.ts`](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/migrator.ts)
and the shared [`drizzle-orm/src/migrator.ts`](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/migrator.ts) verbatim:

```ts
// bun-sqlite/migrator.ts
export function migrate<TSchema extends Record<string, unknown>>(
  db: BunSQLiteDatabase<TSchema>,
  config: MigrationConfig,
) {
  const migrations = readMigrationFiles(config);
  db.dialect.migrate(migrations, db.session, config);
}

// migrator.ts (shared across every SQL driver)
export interface MigrationConfig {
  migrationsFolder: string;
  migrationsTable?: string;
  migrationsSchema?: string;
}
export function readMigrationFiles(config: MigrationConfig): MigrationMeta[] {
  const journalPath = `${config.migrationsFolder}/meta/_journal.json`;
  if (!fs.existsSync(journalPath)) throw new Error(`Can't find meta/_journal.json file`);
  const journal = JSON.parse(fs.readFileSync(journalPath).toString());
  for (const entry of journal.entries) {
    const query = fs.readFileSync(`${config.migrationsFolder}/${entry.tag}.sql`).toString();
    // ...split on '--> statement-breakpoint', hash with node:crypto, push MigrationMeta
  }
  return migrationQueries;
}
```

So: **yes, it requires real filesystem reads at runtime**, via plain `node:fs`
(`fs.existsSync`, `fs.readFileSync`) — not `Bun.file`, not anything package/bundle-aware. It reads
exactly two things from `config.migrationsFolder`:

1. `meta/_journal.json` — an ordered list of `{idx, when, tag, breakpoints}` entries drizzle-kit
   writes alongside the migrations.
2. One `<tag>.sql` file per journal entry, split on the literal string
   `--> statement-breakpoint` to get individual statements.

`MigrationConfig.migrationsFolder` is passed straight through to `fs.readFileSync` with no
resolution logic of its own (no `require.resolve`, no `import.meta.url`-relative handling) — it's
the caller's job to hand it an absolute, resolved path that exists at runtime. This is precisely
the same category of problem Mixxxa already solved for ffmpeg/ffprobe/chromaprint.wasm/the Python
sidecar via `electrobun.config.ts`'s `build.copy` + `binaries.ts`'s "next-to-bundle → static path
→ PATH → common dirs" resolution ladder — a naive `migrationsFolder: "./drizzle"` (fine in `bun
dev`, where cwd is the repo) would silently fail to resolve once packaged, because a packaged
Electrobun app's cwd/module-resolution roots are not the dev source tree.

**Two independent paths to making that work, in order of recommendation:**

### 2.2 Recommended: skip `readMigrationFiles`'s fs reads entirely — embed migrations as strings

The `migrate()` wrapper above is a thin convenience function. The actual work happens one level
down, in `SQLiteSyncDialect.migrate()`
([`drizzle-orm/src/sqlite-core/dialect.ts:939`](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/sqlite-core/dialect.ts#L939),
read verbatim on 2026-09-12), whose signature is:

```ts
migrate(
  migrations: MigrationMeta[],
  session: SQLiteSession<'sync', ...>,
  config?: string | MigrationConfig,
): void
```

This takes **already-parsed** `MigrationMeta[]` — `{ sql: string[]; folderMillis: number; hash:
string; bps: boolean }` — and does the real work: creates `__drizzle_migrations` if missing,
reads the last-applied `created_at`, and runs any migration whose `folderMillis` is newer, each
inside `BEGIN`/`COMMIT`. **`db.dialect` and `db.session` are public properties** on
`BunSQLiteDatabase` (it extends `BaseSQLiteDatabase`), so this call is directly reachable from
application code — nothing here is private/internal-only.

This means the `fs.readFileSync` calls inside `bun-sqlite/migrator.ts`'s `readMigrationFiles()`
are not load-bearing to the actual migration mechanism — they exist purely to turn on-disk `.sql`
files + `_journal.json` into the same `MigrationMeta[]` shape `dialect.migrate()` wants. **You can
build that array yourself at build time and skip the runtime fs reads entirely.**

This is not a hypothetical workaround — it is the *documented, supported* approach for
filesystem-hostile runtimes. Reading
[`drizzle-orm/src/expo-sqlite/migrator.ts`](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/expo-sqlite/migrator.ts)
verbatim (Expo apps face the identical "no arbitrary fs access to a `node_modules`-adjacent
migrations folder inside a packaged bundle" problem):

```ts
interface MigrationConfig {
  journal: { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] };
  migrations: Record<string, string>;   // e.g. { m0000: "CREATE TABLE ...", m0001: "..." }
}
async function readMigrationFiles({ journal, migrations }: MigrationConfig) {
  // looks up migrations[`m${idx.toString().padStart(4,'0')}`] — no fs calls at all
}
export async function migrate(db, config: MigrationConfig) {
  const migrations = await readMigrationFiles(config);
  return db.dialect.migrate(migrations, db.session);
}
```

Expo's `drizzle-kit` integration has a Babel plugin that turns the generated `drizzle/` folder
into exactly this `{journal, migrations}` object as a JS module at build time, so the packaged app
never touches the filesystem for migrations — Drizzle's own docs for Expo ship this as the
supported pattern (same repo, `drizzle-orm/src/expo-sqlite/migrator.ts`, confirming the shape is
a first-class supported config variant of `MigrationConfig`, not a hack against private internals).

**Real prior art doing the same thing in a Bun-based, packaged desktop-adjacent app**: searching
GitHub code for `drizzle-orm/bun-sqlite/migrator` turned up
[`Kilo-Org/kilocode`](https://github.com/Kilo-Org/kilocode) (a fork of `sst/opencode`, a
Bun-based, distributable CLI/desktop tool), `packages/opencode/src/storage/db.ts` (fetched via
`gh api`, current `main` as of 2026-09-12):

```ts
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
declare const KILO_MIGRATIONS: { sql: string; timestamp: number; name: string }[] | undefined

// narrow to the journal-array overload; bypasses drizzle's folder-based overload entirely
const migrateFromJournal = migrate as unknown as
  (db: SQLiteBunDatabase, entries: Journal) => void

function migrations(dir: string): Journal {
  // dev-mode fallback: reads a migration.sql per subdirectory off disk
  const dirs = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
  return dirs.map(name => {
    const file = path.join(dir, name, "migration.sql")
    if (!existsSync(file)) return
    return { sql: readFileSync(file, "utf-8"), timestamp: time(name), name }
  }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)
}

// at startup:
const entries = typeof KILO_MIGRATIONS !== "undefined"
  ? KILO_MIGRATIONS                                            // bundled/packaged build
  : migrations(path.join(import.meta.dirname, "../../migration"))  // dev build
applyMigrations(db, entries)
```

`KILO_MIGRATIONS` is injected by their bundler (a `define`-style build-time constant, same
mechanism as Vite's `define` or `bun build --define`) as a literal array of already-read
`{sql, timestamp, name}` triples — so the **packaged** binary embeds migration SQL as string
literals baked into the JS bundle itself, and only the **dev** build reads `.sql` files off disk.
This is exactly the architecture recommended below for Mixxxa, independently arrived at by a real
production Bun app solving the same "ship migrations inside a single-binary/packaged artifact"
constraint (there is no Electron in their stack, so this isn't an Electron-`app.getPath()`
pattern — it's a same-shape Bun-packaging pattern, arguably more directly applicable to Electrobun
than any Electron prior art would be).

### 2.3 Concrete recipe for Mixxxa

1. **Dev-time only**: `drizzle-kit generate` writes `apps/mixxxa/drizzle/000x_name.sql` +
   `apps/mixxxa/drizzle/meta/_journal.json`, driven by a `drizzle.config.ts` pointing `schema` at
   the new Drizzle schema module and `out` at `./drizzle`. `drizzle-kit` stays a devDependency only
   — confirmed as the intended architecture by Drizzle's own kit docs ("Drizzle Kit is a CLI...
   development tool"), and this sidesteps the `bun:sqlite`-detection bugs in §TL;DR entirely,
   since `generate` never opens a live DB connection (it diffs schema snapshots, not a database).
2. **Build step** (new, small): a script (or a Bun `type: "text"` import per file, since Bun's
   bundler supports importing a file's contents as a string via `with { type: "text" }`) turns
   `drizzle/meta/_journal.json` + each `drizzle/000x_*.sql` into one generated
   `apps/mixxxa/src/bun/db/migrations.generated.ts` exporting a `{journal, migrations: Record<string,string>}`
   object (same shape as `expo-sqlite`'s `MigrationConfig`, or the flat `{sql,timestamp,name}[]`
   shape `kilocode` uses) — committed or generated as part of `bun run build`, either works since
   it's derived, deterministic output from the checked-in `.sql` files.
3. **Runtime**: `getDb()` in `localDb.ts` calls `db.dialect.migrate(migrations, db.session)`
   directly (bypassing `drizzle-orm/bun-sqlite/migrator`'s exported `migrate()` and its fs reads
   altogether) using the array built from `migrations.generated.ts`, immediately after opening the
   `Database` and setting WAL — replacing every `SCHEMA_SQL` / `ALTER TABLE` block currently in
   `getDb()` (lines 76–137 today).
4. **No new `build.copy` entries are needed** — this is the main payoff of embedding: migrations
   travel inside the same JS bundle as the rest of `src/bun/**`, exactly like the existing app code
   does, with zero new packaged-path-resolution surface. (If Mixxxa ever preferred shipping raw
   `.sql` files instead of embedding them as strings, the fallback would be a `build.copy` entry
   `{ [rel(migrationsDir)]: "bun/drizzle" }` plus a runtime path resolved the same way
   `binaries.ts` resolves `orbit-sidecar` — but §2.2's embed approach avoids needing this, so it's
   listed only as the non-recommended alternative.)

### 2.4 Is drizzle-kit avoidable as a runtime dependency? — confirmed yes, this is the standard shape

Drizzle's own kit-overview docs (fetched 2026-09-12) state plainly: *"You have your TypeScript
Drizzle schema as a source of truth and Drizzle lets you generate SQL migration files based on
your schema changes with `drizzle-kit generate` and then you can apply them to the database during
runtime of your application"* — via `drizzle-orm`'s `migrate()`, a **separate, much smaller**
runtime import than the `drizzle-kit` CLI package. `drizzle-kit` is explicitly scoped as a `-D`
devDependency in every setup example across the docs and in `kilocode`'s own `package.json`
pattern (migrations are generated once at development time, the CLI never ships). Given §2.2,
Mixxxa's packaged app doesn't even need `drizzle-orm/bun-sqlite/migrator` at runtime — only
`drizzle-orm/bun-sqlite` (for `drizzle()`, the dialect and session) plus the generated migration
data module, both of which are already part of the app's own bundle rather than an extra runtime
dependency.

## 3. Other gaps/gotchas for a desktop-app context (question 3)

- **`COALESCE(?, col)` dynamic-update pattern (`writeAnalyzedValues` in `localDb.ts`)**: fully
  preservable via the raw `sql` escape hatch — Drizzle's docs (fetched 2026-09-12) describe
  `db.execute(sql\`...\`)` / `db.run(sql\`...\`)` as first-class, not a last resort: *"you might
  simply want to generate queries as they are... we provide the `sql.raw()` function"* alongside
  parameterized `sql\`...${value}...\`` templating. Nothing about `COALESCE(?, analyzed_bpm)`
  requires the query builder — it's ordinary parameterized SQL, so `writeAnalyzedValues` can stay
  essentially line-for-line, just wrapped as `db.run(sql\`UPDATE content SET analyzed_bpm =
  COALESCE(${values.analyzedBpm ?? null}, analyzed_bpm), ... WHERE id = ${trackId}\`)` (or kept as
  a plain prepared statement via `db.$client`, the underlying raw `bun:sqlite` `Database`, which
  Drizzle always exposes per §1.1).
- **Dynamic column lists** (`replaceLibrary`'s `LOCAL_CONTENT_COLUMNS.map(col => \`${col} = ?\`)`
  UPDATE, and the `restoreLocal.run(...params)` spread): also expressible via `sql.raw()` /
  `sql.join()` (both documented composition utilities), since these are building SQL text
  dynamically from a column-name array, not expressing something the relational builder has a
  vocabulary for (per-row dynamic `SET` lists aren't something any SQL query builder — Drizzle
  included — abstracts nicely; raw SQL remains the right tool here, not a workaround).
- **Ad-hoc joins** (`TRACK_SELECT`'s `LEFT JOIN artist`/`LEFT JOIN key`, `playlist_song JOIN
  content`): these *do* map cleanly onto Drizzle's query builder (`.leftJoin()`, `.innerJoin()`)
  once tables are declared as Drizzle schema objects — no raw SQL needed for these specifically,
  they were only flagged as a risk in the ticket, not a confirmed gap.
- **Hand-typed `Row` interfaces vs Drizzle's type inference**: Drizzle infers row types from the
  schema definition (`$inferSelect`/`$inferInsert`), which is strictly more automated than
  `localDb.ts`'s current per-function inline `type Row = {...}` blocks — a net simplification, not
  a gap, once tables are declared in Drizzle schema form. Raw `sql\`\`` calls still return
  loosely-typed rows unless given an explicit generic, so the hand-typed `Row` pattern doesn't
  disappear entirely — it stays exactly where raw SQL stays (COALESCE updates, dynamic column
  UPDATEs), it just retreats from the majority of reads/writes that move to the builder.
- **WAL mode / concurrent access**: no interaction with Drizzle found beyond what's noted in
  §1.3 — Drizzle doesn't touch pragmas or open its own connection when given `client`, so WAL
  behavior is exactly what `getDb()` configures today, unaffected by adding Drizzle on top.
  Mixxxa's single-process, single-`Database`-instance-via-singleton model (`let db: Database |
  null`) means there's no new concurrent-writer risk Drizzle introduces — it's strictly a query/
  migration layer over the same one connection.
- **`drizzle-kit`'s bun:sqlite detection bugs (§TL;DR)** are worth flagging explicitly as a CI/dev-
  workflow gotcha even though they don't block runtime: anyone running `drizzle-kit studio` or
  `drizzle-kit pull` against the Mixxxa DB from the CLI will hit "Please install either
  'better-sqlite3' or '@libsql/client'" ([drizzle-orm#4350](https://github.com/drizzle-team/drizzle-orm/issues/4350)).
  If Drizzle Studio (browsing the local DB) is ever wanted as a dev tool, that means installing
  `better-sqlite3` as an *additional* devDependency purely to satisfy drizzle-kit's own CLI
  connector — an easy trap to fall into and misdiagnose as a Mixxxa bug, worth a comment in the
  implementation plan.

## Sources

- [drizzle-orm/src/bun-sqlite/driver.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/driver.ts) — read verbatim via `gh api`, 2026-09-12
- [drizzle-orm/src/bun-sqlite/session.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/session.ts) — read verbatim, 2026-09-12
- [drizzle-orm/src/bun-sqlite/migrator.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/bun-sqlite/migrator.ts) — read verbatim, 2026-09-12
- [drizzle-orm/src/migrator.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/migrator.ts) — read verbatim, 2026-09-12
- [drizzle-orm/src/sqlite-core/dialect.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/sqlite-core/dialect.ts) (`migrate()`, ~line 939) — read verbatim, 2026-09-12
- [drizzle-orm/src/expo-sqlite/migrator.ts](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/expo-sqlite/migrator.ts) — read verbatim, 2026-09-12
- [Kilo-Org/kilocode: packages/opencode/src/storage/db.ts](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/storage/db.ts) — read verbatim via `gh api`, 2026-09-12 (found via `gh search code "drizzle-orm/bun-sqlite/migrator"`)
- Drizzle docs: [Connect Bun SQLite](https://orm.drizzle.team/docs/connect-bun-sqlite), [Kit overview](https://orm.drizzle.team/docs/kit-overview), [Migrations](https://orm.drizzle.team/docs/migrations), [Raw SQL](https://orm.drizzle.team/docs/sql) — fetched 2026-09-12
- Bun docs: [bun:sqlite](https://bun.com/docs/api/sqlite) — fetched 2026-09-12
- drizzle-orm GitHub issues: [#3423](https://github.com/drizzle-team/drizzle-orm/issues/3423), [#4350](https://github.com/drizzle-team/drizzle-orm/issues/4350), [#1520](https://github.com/drizzle-team/drizzle-orm/issues/1520), [#1153](https://github.com/drizzle-team/drizzle-orm/issues/1153) (closed, historical)
- This repo: `apps/mixxxa/src/bun/db/localDb.ts`, `apps/mixxxa/src/bun/db/schema.ts`, `apps/mixxxa/electrobun.config.ts` (`build.copy` mechanism), `docs/research/all-in-one-infer-packaging.md` (format precedent)
