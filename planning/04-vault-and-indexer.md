# 04 — vault and indexer

## the vault contract

A vault is a directory the user picks. We promise:

1. We will read `.org` files in this directory recursively.
2. We will create `daily/YYYY-MM-DD.org` for daily notes if missing.
3. We will write back to a file only as a result of a user action (capture, edit, or first-index ULID stamp — see below).
4. We will never delete a file the user did not delete.
5. The index in `gnosis.sqlite` is derivable; if missing or stale, we rebuild it.

Vault location is stored in app config (`tauri-plugin-store` or simple `vault.json` at the OS app-data dir). On first launch, no vault: show the "Pick a vault" dialog backed by `tauri-plugin-dialog`.

## directory layout inside the vault

We do not enforce structure. We only assume:

- `daily/` may exist; we put daily notes there if not specified otherwise in settings.
- Anything else is user territory. We index every `.org` file regardless of path.
- We ignore files starting with `.` and any path under a `.git/` folder.

## the indexer's job

Given the vault path, produce SQLite rows that mirror the file contents at the block level.

The indexer is composed of three steps:

1. **Discover.** Walk the vault, list `.org` files with mtime + size + sha256.
2. **Parse.** For each file whose mtime+size differs from what's recorded (or is new), parse to AST. Mint ULIDs for headings without `:ID:`. **Write back the file** if any ULIDs were minted, before indexing.
3. **Index.** Upsert blocks into SQLite. Delete blocks whose ULIDs no longer appear in the file.

Files that disappear from the vault: their rows are deleted on next full scan.

## modes

- **Cold index (first launch / corrupt DB).** Walk the entire vault. ~1k files in <2 s on Apple Silicon is the budget. We will measure on a synthetic vault.
- **Incremental index (after edit).** Only the touched file is parsed and upserted. Triggered by the editor's debounced write.
- **Manual refresh (palette command).** Same as cold index but invoked by user.
- **Watcher (DEFERRED).** External edits are not picked up live in MVP. Listed as v0.2 issue (V2).

## ULID side effect — read carefully

When we parse a heading without an `:ID:` property, we generate a ULID and **rewrite the file** so the heading gains:

```
* TODO buy milk
  :PROPERTIES:
  :ID:       01J9X8Y7Z6...
  :END:
```

This is the only way blocks remain stable across edits. Without stable IDs, a rename or reorder makes views forget what they referenced.

Implications:

- The first cold index of an existing org-mode vault will rewrite many files. The first-run dialog spells this out plainly: "gnosis writes a stable `:ID:` property into each heading on first index. If your vault is not under git or another backup, take a snapshot before continuing." We accept the immediate write rather than a dry-run preview gate; the warning carries the weight, and we surface counts in the post-index toast ("idsMinted: 412").
- The rewrite must preserve everything else byte-for-byte (round-trip safety, see `05-org-parser.md`).
- The indexer logs every file it modifies during ID stamping at `info` level via `tauri-plugin-log`.
- Daily-note path is fixed at `daily/YYYY-MM-DD.org` (flat). No year/month nesting in MVP. Configurable later (issue V-misc).

## performance budget

| Operation | Target | Hard limit |
|-----------|--------|-----------|
| Cold index 1000 files (~3 MB total org) | <2 s | <5 s |
| Cold index 5000 files | <8 s | <15 s |
| Incremental index single file | <50 ms | <200 ms |
| Capture round-trip (Enter → view shows) | <80 ms | <250 ms |

Measured on M1/M2 macOS dev machine. If we exceed hard limits, the indexer moves to a Rust-side Tauri command (see `02-architecture.md` "known unknowns"). Decision criterion: measure during phase 4, not before.

## storage location

- Vault: user-chosen.
- Index DB: `$APP_DATA/gnosis.sqlite` (Tauri's `BaseDirectory.AppData`).
- Settings: `$APP_DATA/settings.json` (or `tauri-plugin-store`).
- Logs: `$APP_DATA/logs/gnosis.log` via `tauri-plugin-log`.

## interface in `packages/core`

Pseudocode signatures only:

```
type Vault = {
  rootPath: string
  list(): Promise<FileMeta[]>          // path, mtime, size
  read(path): Promise<string>
  write(path, content): Promise<void>
  ensureDir(path): Promise<void>
}

type Indexer = {
  cold(): Promise<IndexResult>
  incremental(path): Promise<IndexResult>
  remove(path): Promise<void>
}

type IndexResult = {
  filesParsed: number
  blocksUpserted: number
  blocksDeleted: number
  idsMinted: number    // surfaced in logs and the first-run summary toast
  warnings: ParseWarning[]
}
```

The `Vault` interface has two implementations:

- **TauriVault** in `apps/desktop` using `tauri-plugin-fs`.
- **MemoryVault** in `packages/core/test` for unit tests.

The indexer takes a `Vault` and a `Db`. Both are interfaces. Tests can mock either.

## edge cases the plan explicitly addresses

- **Symlinks.** Do not follow symlinks across the vault root in MVP. Skip them, log a warning. Future issue.
- **Files >1 MB.** Parse but warn. We don't expect huge org files; if encountered, log and continue.
- **Files with bad encoding.** UTF-8 only. Reject others with a logged warning. Future issue: prompt the user.
- **A heading with `:ID:` that already exists in another file (collision).** Keep the first-seen one, log a collision warning, regenerate the second's ID. Surface in the post-index toast.
- **A heading whose ULID we minted but the user manually changed back to an unstamped form.** Treat as a new heading, mint a new ID. Old block becomes orphaned and is deleted on next index.
- **Concurrent capture during cold index.** Capture queues until cold index completes; UI shows a loading state in the palette. Hard limit 30 s before we surface an error.

## known unknowns

- **`tauri-plugin-fs` directory walk performance.** It exposes `readDir` recursively, but performance over thousands of files isn't documented. Resolution: 30-minute spike with a 5k-file vault during phase 4. If too slow, fall back to a Rust command using `walkdir`.
- **Large vault first-run UX.** If cold index takes 8 seconds, that's a noticeable wait. Resolution: show indexing progress in the splash, not a frozen window.
- **Sha256 vs mtime+size as freshness check.** mtime+size is fast but lies on copy/paste. sha256 is correct but slower. MVP uses mtime+size; we revisit if users report stale views.

## what we are NOT building here

- File watcher (deferred, issue V2).
- Conflict resolution UI (no concurrent writers in MVP scope).
- Trash / undo for accidental writes (rely on user's own backups).
- Multi-vault / vault switching (single vault per launch; restart to switch).
