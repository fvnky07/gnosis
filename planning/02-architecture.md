# 02 — architecture

## one-paragraph picture

A Tauri 2 desktop shell embeds a Vite + React bundle. The bundle owns all UI; Rust owns filesystem, SQLite, and global shortcuts via official Tauri plugins. Vault `.org` files are the source of truth. A pure-TypeScript core library (`packages/core`) parses files into an AST and feeds an indexer that writes a derived SQLite. Views (`packages/views`) read SQLite via type-safe queries and render into the right sidebar. The editor (`packages/editor`) writes to files; writes invalidate the index, which writes to SQLite, which invalidates view queries.

## layers, top to bottom

```
+-------------------------------------------------------------+
|  apps/desktop  (Vite + React wrapped by Tauri)              |
|  - shell, tabs, palette, settings UI                        |
+----------+--------------------------------+-----------------+
|          |                                |                 |
| @gnosis/ui       | @gnosis/views (right    | @gnosis/editor  |
| (shadcn Command  | sidebar: journal,       | (CodeMirror +   |
| primitive +      | agenda, todos)          | cm-vim, default-|
| TanStack         |                         | on; see doc 15) |
| Virtual)         |                         |                 |
+------------------+-------------------------+-----------------+
| Palette engine — providers (commands, fileSearch, blockSearch,  |
| capture, view, templates, outline, recentFiles, tabs) +         |
| TanStack Virtual list + mode state machine. The moat. Doc 09.   |
+-----------------------------------------------------------------+
| Global vim handler (tinykeys) — runs when no editor / input has |
| focus; drives LIST mode in palette + right sidebar, leader      |
| chords, focus stack.                                            |
+-----------------------------------------------------------------+
|                                                             |
|  @gnosis/core  (parser, AST, vault ops, indexer logic)      |
|                                                             |
+-------------------------------------------------------------+
|                                                             |
|  @gnosis/db  (Drizzle schema + query builders)              |
|                                                             |
+-------------------------------------------------------------+
|  Tauri plugins: fs, sql, dialog, global-shortcut, log       |
|  (Rust side; gnosis writes no custom Rust commands in MVP)  |
+-------------------------------------------------------------+
|  Filesystem: vault/*.org   |   App data: gnosis.sqlite      |
+-------------------------------------------------------------+
```

## hard rules about layering

- `packages/core` is pure TypeScript with no Tauri imports. Runs in node for tests. The vault adapter is an interface; Tauri provides one implementation, an in-memory adapter backs the test suite.
- `packages/db` exposes typed query builders; the runtime that executes them lives in `apps/desktop` and uses `tauri-plugin-sql`. See `06-database-schema.md` for the Drizzle-vs-plugin trade.
- `packages/editor` knows nothing about views. `packages/views` knows nothing about the editor. They communicate through Zustand stores in `apps/desktop` (see `07-state-and-stores.md`).
- `apps/desktop` is the only place that imports Tauri APIs.

## data flow for the four core actions

### capture (palette → file)

```
Palette submit
  → command handler in apps/desktop
  → core.capture({ kind, body, tags, scheduled? })
  → core resolves "today's daily note" path, parses if exists, appends block
  → Tauri fs writes file
  → indexer schedules a re-parse of that file
  → indexer writes blocks to sqlite (upsert on ULID)
  → views invalidate query keys for affected tags / dates
  → UI re-renders
```

Latency target: under 80 ms from Enter to view update on a vault of 1k files.

### edit (editor → file → index)

```
CodeMirror buffer change (debounced 250 ms idle)
  → write to file
  → indexer re-parses file
  → diff old AST vs new AST at the block level
  → upsert/delete affected rows
  → views invalidate
```

We do NOT round-trip the full vault parse on every edit. Only the touched file.

### open (palette → editor)

```
Palette pick
  → editorStore.openBuffer({ path, blockId? })
  → if buffer cached, focus it; else load file, parse, set buffer
  → editor scrolls to block range
```

### view query

```
View component mounts
  → queryStore reads compiled query (e.g., "tag = journal", date desc)
  → tauri-plugin-sql runs SQL
  → results held in TanStack-style cache (we do not pull TanStack Query in MVP — see 07)
  → invalidations from indexer trigger refetch
```

## process and runtime topology

- Single Tauri main process. One webview window. No multi-window in MVP.
- Indexer runs in the webview's main thread for MVP. If profiling shows blocking on >5k file vaults we move it to a Tauri command running on a Rust thread; this is in-scope only if measured (see `04-vault-and-indexer.md` "performance budget").
- Global shortcut handler registers Cmd+Shift+K (configurable) for "show window + open palette" via `tauri-plugin-global-shortcut`.

## why these boundaries

- **Pure core** keeps the parser testable without Tauri. The parser is the single highest-risk piece (round-trip safety); we want fast unit feedback.
- **No Rust commands** means we avoid hand-rolled IPC in MVP. The official plugins do everything we need: read/write files, run SQL, show dialogs, register shortcuts.
- **Vite + React** for `apps/desktop` (no Next.js, no server runtime). The bundle is a folder of static assets that Tauri loads via `file://`. See `12-tauri-and-platform.md` for the Vite config and the small set of Tauri-specific constraints (`base: './'`, no Node-only imports in client code).

## what we are NOT building in this architecture

- No Electron-style preload scripts; Tauri's permission model is per-plugin, declared in `capabilities/*.json`.
- No GraphQL, no tRPC, no API layer. The "API" is the function signatures of `@gnosis/core`.
- No Redux, no Jotai. One Zustand-style state library, used sparingly.
- No worker threads for the indexer in MVP unless measured.

## known unknowns

- **Indexer runs on UI thread is fine?** Probably for MVP-sized vaults (<2k files). Resolution: time `indexAll` against a 2k-file synthetic vault during phase 4. If >300 ms, move it.
- **Drizzle runtime with `tauri-plugin-sql`?** Drizzle's ORM doesn't ship a driver for this plugin. Resolution: spike during phase 4 (see `06-database-schema.md`). Most likely outcome: keep Drizzle's schema + query builder for type safety, execute the produced SQL strings via the plugin manually.
- **Whether to ever leave the main thread?** We may never need to. Decision deferred until measurement.
