# 06 — database schema

## what the DB is and isn't

`gnosis.sqlite` is a derived index. The vault folder is the source of truth. Deleting the SQLite file is safe; it rebuilds on next launch via cold index.

Therefore: no migrations beyond schema setup, no foreign key cascades to user data, no triggers. A bumped schema version means "drop and rebuild." The user never loses content.

## tables

We aim for the smallest schema that supports the three views and the palette's file/block search. Five tables.

### `files`
| column | type | notes |
|--------|------|-------|
| `path` | TEXT PK | absolute path or vault-relative; pick one and stick with it (vault-relative recommended) |
| `mtime_ms` | INTEGER | last seen mtime |
| `size_bytes` | INTEGER | last seen size |
| `title` | TEXT | from `#+TITLE:` if present |
| `file_tags` | TEXT | JSON array |
| `indexed_at` | INTEGER | epoch ms |

### `blocks`
| column | type | notes |
|--------|------|-------|
| `id` | TEXT PK | ULID |
| `path` | TEXT FK files(path) ON DELETE CASCADE | |
| `level` | INTEGER | heading depth |
| `todo` | TEXT NULL | `TODO` or `DONE` or NULL |
| `priority` | TEXT NULL | `A`/`B`/`C` |
| `title` | TEXT | heading title without keyword/priority/tags |
| `tags` | TEXT | JSON array of effective tags (denormalized) |
| `properties` | TEXT | JSON object |
| `scheduled` | TEXT NULL | ISO 8601 datetime |
| `scheduled_active` | INTEGER NULL | 1 if `<...>`, 0 if `[...]` |
| `deadline` | TEXT NULL | ISO 8601 datetime |
| `body` | TEXT | raw body, for snippet rendering |
| `range_start` | INTEGER | byte offset in file |
| `range_end` | INTEGER | |
| `parent_id` | TEXT NULL | ULID of nearest ancestor heading; resolved at index time |
| `created_ms` | INTEGER | from `:CREATED:` if present, else file mtime |

### `block_tags`
Many-to-many for tag queries.
| column | type |
|--------|------|
| `block_id` | TEXT FK blocks(id) ON DELETE CASCADE |
| `tag` | TEXT |
| PRIMARY KEY (`block_id`, `tag`) | |

We denormalize the tag array on `blocks.tags` AND maintain `block_tags` so we can query `WHERE tag = 'journal'` cheaply with an index. This duplication is fine for an index that rebuilds.

### `app_state`
Key-value for last-open vault, palette history, recent files, theme, and the vim persistence bag (marks, registers, search history). JSON values.
| column | type |
|--------|------|
| `key` | TEXT PK |
| `value` | TEXT |
| `updated_ms` | INTEGER |

Vim-related keys (see `15-vim-mode.md`):
- `vim.marks.local` — `{ "<filePath>": { "a": { line, ch }, "b": ... } }` for single-file marks
- `vim.marks.global` — `{ "A": { path, line, ch }, "B": ... }` for cross-file marks
- `vim.registers.named` — `{ "a": "<text>", "b": ... }` for `"a`–`"z` (numbered + anonymous + clipboard registers stay session-scoped)
- `vim.searchHistory` — `["last query", "second to last", ...]` capped at 50
- `vim.exHistory` — `[":capture", ":done", ...]` capped at 50

### `meta`
Single-row table for schema version + index epoch.
| column | type |
|--------|------|
| `schema_version` | INTEGER |
| `vault_root` | TEXT |
| `last_full_index_ms` | INTEGER |

## indexes

```
CREATE INDEX blocks_by_path        ON blocks(path);
CREATE INDEX blocks_by_todo        ON blocks(todo) WHERE todo IS NOT NULL;
CREATE INDEX blocks_by_scheduled   ON blocks(scheduled) WHERE scheduled IS NOT NULL;
CREATE INDEX blocks_by_deadline    ON blocks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX blocks_by_created     ON blocks(created_ms);
CREATE INDEX block_tags_by_tag     ON block_tags(tag);
```

### `blocks_fts` (FTS5 virtual table — added for MVP, not deferred)

```
CREATE VIRTUAL TABLE blocks_fts USING fts5(
  title, body,
  content='blocks', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
```

Plus the standard FTS5 sync triggers (`blocks_ai`, `blocks_ad`, `blocks_au`) so the FTS index stays current on insert/update/delete of `blocks`. We do FTS5 at MVP time because the palette `b ` block-search provider is on the hot path of the moat (see `09-command-palette.md`). LIKE on tens-of-thousands of blocks would be perceptible latency in the palette; FTS5 returns sub-10 ms at 100k rows on M-series Macs. Worth the schema surface.

Query shape for `blockSearch` provider:

```
SELECT blocks.id, blocks.path, blocks.title,
       snippet(blocks_fts, 1, '<mark>', '</mark>', '…', 32) AS snip,
       bm25(blocks_fts) AS rank
FROM blocks_fts
JOIN blocks ON blocks.rowid = blocks_fts.rowid
WHERE blocks_fts MATCH :q
ORDER BY rank
LIMIT 50;
```

LIKE remains the choice for tiny tables (settings search, etc.). Never for vault block content.

## the views' query shapes (so the schema is justified)

### journal
```
SELECT id, path, title, body, tags, created_ms
FROM blocks
WHERE id IN (SELECT block_id FROM block_tags WHERE tag = 'journal')
ORDER BY created_ms DESC
LIMIT 200 OFFSET ?
```

### todos kanban
```
SELECT id, title, todo, priority, scheduled, deadline, tags
FROM blocks
WHERE todo IS NOT NULL
ORDER BY
  CASE WHEN todo = 'TODO' THEN 0 ELSE 1 END,
  COALESCE(priority, 'Z'),
  COALESCE(deadline, scheduled, '9999')
```

### agenda (week view)
```
SELECT id, title, scheduled, deadline, todo, priority
FROM blocks
WHERE (scheduled BETWEEN :start AND :end)
   OR (deadline  BETWEEN :start AND :end)
ORDER BY COALESCE(scheduled, deadline)
```

### palette file search
```
SELECT path, title FROM files WHERE path LIKE :q OR title LIKE :q LIMIT 20
```

### palette block search
```
SELECT id, path, title, body FROM blocks
WHERE title LIKE :q OR body LIKE :q LIMIT 20
```

## Drizzle vs `tauri-plugin-sql` — the open question

Drizzle's ORM expects a node-style driver. `tauri-plugin-sql` exposes `Database.load(...)` and `db.execute(...)` / `db.select(...)` from the JS side. There is no first-party Drizzle driver for it.

Options:

1. **Use Drizzle for schema definition + query building, execute the produced SQL via the plugin manually.** Drizzle's query builder can serialize to SQL strings. We get type safety on table shapes and query results (via Drizzle's inferred types), and we run the strings through `tauri-plugin-sql`. This is the planned path.
2. **Drop Drizzle entirely.** Hand-write SQL with a thin typed wrapper. Fewer dependencies, less magic. Tradeoff: no compile-time guarantees that SQL columns match TS types.
3. **Use `@op-engineering/op-sqlite` or `better-sqlite3` directly via a custom Tauri command.** More code in Rust. Ruled out for MVP — we want plugins, not custom IPC.

Decision: option 1, **with a 2-hour spike during phase 4**. If Drizzle's query-string output doesn't reliably bind parameters in a way `tauri-plugin-sql.execute(sql, params)` accepts, fall back to option 2.

## migrations

For MVP: a single bootstrap. On launch:

```
SELECT schema_version FROM meta;
if (missing or != CURRENT_SCHEMA_VERSION):
  drop all tables, recreate, set version, kick off cold index
```

Versioned migrations with data preservation are a v0.2 concern. Until then, a schema bump = a rebuild, which is cheap because the vault is the truth.

## interface in `packages/db`

```
type Db = {
  init(): Promise<void>          // create tables if missing, run vacuum, set version
  files: {
    upsert(file: FileRow): Promise<void>
    delete(path: string): Promise<void>
    list(): Promise<FileRow[]>
  }
  blocks: {
    upsertMany(rows: BlockRow[]): Promise<void>
    deleteByPath(path: string): Promise<void>
    deleteIds(ids: string[]): Promise<void>
    byTag(tag: string, opts?): Promise<BlockRow[]>
    byScheduledRange(start: string, end: string): Promise<BlockRow[]>
    byTodoState(): Promise<BlockRow[]>
    search(q: string): Promise<BlockRow[]>
    byId(id: string): Promise<BlockRow | null>
  }
  appState: {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
  }
}
```

`Db` is an interface. Tests use an in-memory implementation backed by `better-sqlite3` (devDep only) or just JS Maps; production uses `tauri-plugin-sql`.

## known unknowns

- **`tauri-plugin-sql` parameter binding.** We need to verify that `?` placeholders bind correctly for arrays (for `IN (...)` with N items). If not, generate dynamic SQL. Settle in spike.
- **Performance of LIKE on 50k blocks.** Probably fine; LIKE with a leading wildcard is the slow case, and we can avoid that for prefix search. Revisit with measurement; FTS5 is the escape hatch.
- **`block_tags` write amplification.** Every block update means delete-then-insert into `block_tags`. For incremental indexing of single files, this is bounded and fine. We don't pre-optimize.

## what's NOT in this schema

- No `users` table. Single user.
- No revision history. Files have git or backup; we don't.
- No FTS5 in MVP.
- No views (SQL views) — keep the schema flat and obvious.
- No triggers.
