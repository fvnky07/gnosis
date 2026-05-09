# 01 — overview and MVP

## one-line product

A local-first desktop app where a folder of `.org` files is the database, the command palette is the only interface that matters, and views are saved queries over your tagged blocks.

## what gnosis is

- **Local-first.** No server, no sync, no account. The user picks a folder; that folder is the vault.
- **File-based.** `.org` files are the source of truth. SQLite is a derived index; deleting it must be safe (it rebuilds on next launch).
- **Block-oriented.** Every heading is a block. Blocks carry tags, scheduling, todo state, priority, properties. Blocks are the unit of capture, query, and edit.
- **Palette-driven.** Cmd+K (and `Space Space` in normal mode) is the app. Capture, search, navigation, view-opening, command execution all flow through one modal.
- **Vim-first.** Vim is the default interaction mode — not opt-in. Modal navigation works inside the editor and across the entire shell (palette, sidebars, tabs, views). Users who don't want vim turn it off; the product is built for users who turn it on. See `15-vim-mode.md`.
- **Org-compatible.** A user with Emacs and a working org-mode setup can open the vault, edit anything, and gnosis re-indexes on next launch without data loss.

## what gnosis is not (in MVP)

- Not a sync engine. No iCloud, no Dropbox glue. The user can put the vault in a synced folder if they want; we don't help.
- Not a mobile app. `apps/mobile` exists as scaffold only; it does not ship.
- Not a web app. `apps/web` is a marketing landing page only; the actual app is desktop.
- Not a plugin host. No public extension API. Internal modules only.
- Not a full org-mode parser. See `05-org-parser.md` for the explicit scope; advanced syntax is deferred.
- Not a file watcher. External edits reflect on next launch or manual refresh.
- Not a syntax-highlighter for org. We use markdown highlighting as a placeholder until v0.2.

## MVP user flow (the success criterion)

Two parallel paths — Cmd-key for non-modal users, vim chords for the primary audience. Both must work end-to-end.

### path A: Cmd-driven (non-vim user)

1. User downloads the desktop binary, opens it.
2. First-run dialog asks for a vault folder. User picks one (empty or existing).
3. App scans, indexes, and shows the minimal shell: editor on today's daily note (auto-created), right sidebar collapsed (open with `Cmd+Shift+B` or `Space tr`), status bar with mode pill on `INSERT`. No left sidebar, no file tree.
4. User hits **Cmd+K**, types `j thoughts on the parser`, hits Enter. Block tagged `:journal:` is appended to today's daily note. Journal view in the right sidebar shows it.
5. User hits **Cmd+K**, types `t buy milk tomorrow`. `TODO` block with a `SCHEDULED:` timestamp lands in today's daily note. Todos kanban shows it in `Backlog`. Agenda shows it on tomorrow's slot.
6. User clicks a block in the journal view; editor jumps to that file at that block. To inspect block metadata, user hits `Cmd+Shift+I` for the block-details popover.
7. User edits the block in the center editor; `.org` file writes; index updates; views refresh.
8. User quits. Next launch reopens the same vault, same tabs, same scroll positions.

### path B: vim-driven (the primary audience)

1–3. Same as A. After step 3, the user presses `Esc` once → mode pill changes to `NORMAL`.
4. User types `:journal thoughts on the parser` and hits Enter. Same outcome as Cmd-K + journal capture.
5. User types `:task buy milk tomorrow`. Same outcome as Cmd-K + task capture.
6. User presses `Ctrl-w l` to focus the right sidebar; mode pill reads `LIST`. `j/k` navigates journal entries, `Enter` opens source. To see metadata of the open block, `Space i` opens the inline details popover.
7. User edits in the center editor; same write/index/refresh. `:w` is a no-op (writes are automatic). `gg` jumps to top, `]]` to next heading, `:done` marks current block DONE.
8. User quits with `:q` (close last buffer → close window). Next launch restores tabs, scroll, and vim state (marks, registers, search history).

If a build does all 16 steps end-to-end on macOS without losing data and without manual SQL, that is MVP.

## explicit non-goals for MVP

| Topic | Why deferred | Tracked in |
|-------|--------------|-----------|
| Mobile app (`apps/mobile`) | Different surface, different palette story | Issue M1 |
| Real-time file watcher | Cross-platform watcher correctness is a project on its own | Issue V2 |
| Org syntax highlighting | Org grammar in CodeMirror is custom work; markdown highlights cover 80% | Issue E1 |
| Full org parser (tables, src blocks, latex, footnotes) | Round-trip risk too high for MVP timeframe | Issue P1 |
| Sync / backup | Out of scope by design | Issue S1 |
| Plugin/extension API | Premature; let internals settle | Issue X1 |
| Landing page (`apps/web`) | Doesn't block usable software | Issue W1 |
| Docs site (`apps/docs`) | Same as above | Issue W2 |
| Cross-vault search | Single vault is the model | Issue Q1 |
| Encrypted vault | Use OS-level encryption | — |
| Windows / Linux installers polished | macOS first; the others get unsigned dev builds | Issue B1 |

## time budget

Ballpark for one engineer, opus-on-call when stuck:

- Scaffold delta + plumbing (docs 03, 12, 13): 1–2 days
- Vault + indexer + parser (docs 04, 05, 06): 4–6 days
- Editor + state plumbing (docs 07, 08): 3–4 days
- Palette + views (docs 09, 10): 4–5 days
- Layout, polish, packaging (docs 11, 12): 2–3 days

Total MVP: **~3 weeks** of focused work. Realistic calendar: **5–6 weeks**. Padding accounts for the Tauri-on-macOS sharp edges in `12-tauri-and-platform.md`.

## guiding constraints (carried into every doc)

1. **The palette is the moat.** Every navigation, command, and contextual action lives in Cmd+K. If a feature exists outside the palette, that is a bug. See `09-command-palette.md`.
2. **No file tree. No left sidebar. No menu bar of buttons.** Files are reached via palette `f ` mode, recents (frecency), and inline links. Outline lives in palette `o ` mode + editor folding. Block details live in a `Cmd+Shift+I` / `Space i` inline popover.
3. **Two-pane shell.** Editor center, optional right sidebar for views, status bar at the bottom. That is the entire chrome. See `11-layout-and-shell.md`.
4. Files are truth. Index is derived. Loss of `.sqlite` must be recoverable.
5. Block IDs (ULIDs) are written back to `.org` files on first index of any heading without `:ID:`. This is a one-way side effect and must be loud in the logs.
6. Vim mode is **on by default** and pervasive — modal keys work in the editor, the palette (telescope-style INSERT/LIST modes), the right sidebar, and the views. See `15-vim-mode.md`. Non-modal users can turn it off in settings; that path is supported but not the primary one.
7. Defer aggressively. `14-roadmap-and-deferred.md` is healthy if it is long.
