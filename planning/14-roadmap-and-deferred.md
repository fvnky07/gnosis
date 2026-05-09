# 14 — roadmap and deferred backlog

## phases (each ends with a runnable demo)

### phase 0 — scaffold delta (½–1 day)
Goal: clean monorepo at target structure, blank desktop shell launches via `bun run tauri:dev`.
Doc: `03-monorepo-and-scaffold-delta.md`.
Done when: Tauri window opens with a placeholder shell, `bun install`, `bun run check-types`, `bun run check` are clean.

### phase 1 — Tauri plumbing (1 day)
Goal: capabilities, plugins, vault picker, log file, app data paths.
Docs: `12-tauri-and-platform.md`.
Done when: user can pick a vault folder via dialog, path persists to `app_state`, logs land in `$APP_DATA/logs/gnosis.log`.

### phase 2 — DB bootstrap + FTS5 (1 day)
Goal: SQLite schema lives (including `blocks_fts` virtual table + sync triggers), app reads/writes a row, FTS5 query returns ranked results on synthetic content.
Docs: `06-database-schema.md`.
Done when: `gnosis.sqlite` is created on first launch, schema-version row is set, an integration test inserts blocks and an FTS5 `MATCH` query returns BM25-ranked results.

### phase 3 — parser core (3 days)
Goal: `packages/core` parses and round-trips MVP org subset.
Docs: `05-org-parser.md`.
Done when: the fixture corpus round-trips byte-for-byte; ID minting splices correctly; warnings collected.

### phase 4 — vault adapter + indexer (2 days)
Goal: cold and incremental indexing produce correct rows; performance budget met.
Docs: `04-vault-and-indexer.md`, `06-database-schema.md`.
Done when: a synthetic 1k-file vault cold-indexes in <2 s; incremental edit round-trips in <50 ms.

### phase 5 — editor + vim core (3 days)
Goal: CodeMirror buffer with placeholder highlighting AND vim default-on with the gnosis ex/motion layer (per `15-vim-mode.md`).
Docs: `08-editor.md`, `15-vim-mode.md`.
Done when: open a file, type in INSERT, Esc → NORMAL, mode pill renders, `:capture`/`:done`/`:schedule` ex commands round-trip, `]]`/`[[` heading motion works, fold ops fire, scroll persists, dirty state visible.

### phase 6 — palette + global vim handler (4 days)
Goal: Cmd+K opens, `Space Space` opens, providers route, two-state picker (INSERT/LIST) works, capture flows work for journal and task. Global handler covers list-mode bindings in panels and views.
Docs: `09-command-palette.md`, `15-vim-mode.md`.
Done when: `j ...`, `t ...`, `f ...`, `b ...`, `v ...`, `> ...` all complete a meaningful round trip; Esc pops the focus stack predictably; which-key popup appears 300 ms after the leader; `:` in the editor exposes the same commands.

### phase 7 — views (3–4 days)
Goal: Journal, Agenda (week+day+month), Todos (kanban+list) render and stay in sync.
Docs: `10-views.md`.
Done when: capturing a task shows it in agenda + todos within 100 ms; clicking a card opens the source block.

### phase 8 — shell polish (1 day)
Goal: two-pane layout (editor + collapsible right sidebar + status bar), tabs, status bar, resize handle, theme, MRU `Ctrl+Tab` overlay, block-details popover. No left sidebar.
Docs: `11-layout-and-shell.md`, `09-command-palette.md`.
Done when: the user flow in `01-overview-and-mvp.md` runs end-to-end without rough edges. Specifically: zero left-sidebar code shipped, palette covers every action, `Cmd+Shift+I` popover renders correctly.

### phase 9 — release prep (1–2 days)
Goal: icons, basic CI, dev build artifacts, docs README.
Docs: `12-tauri-and-platform.md`, `13-build-test-tooling.md`.
Done when: the GitHub release page has a downloadable macOS `.dmg`, even if unsigned.

**Total: ~17 working days = 3 weeks focused, ~5–6 weeks calendar.**

## deferred-to-issues backlog

Each item below is a GitHub issue. Prefix groups: V (vault), P (parser), E (editor), Q (query), U (UI), B (build), T (testing), W (web), M (mobile), X (extensibility), S (sync).

### vault & indexer
- **V1 — Multi-vault / vault switcher.** Currently switching vaults requires restart; ergonomics can improve.
- **V2 — File watcher.** Reflect external edits live via `notify-rs` or `chokidar`. Cross-platform correctness is the main cost.
- **V3 — Drag-rescheduling in agenda.** Need round-trip-safe edits to scheduled timestamps when dragging chips.
- **V4 — Saved queries / virtual views.** Let the user save palette searches as named views in the right sidebar.
- **V5 — Graph view, backlinks panel, canvas mode.**
- **V6 — Conflict UI for concurrent external edits.** Only relevant after V2.
- **V7 — Symlink and bind-mount support.**
- **V8 — Encrypted-at-rest vault.**
- **V9 — Trash / undo for accidental writes.**

### parser
- **P1 — Full org-mode parser.** Tables, source blocks, footnotes, latex, inline emphasis, repeating timestamps, logbook, archive, cookies.
- **P2 — Multi-line property values.**
- **P3 — Tag inheritance configuration** (currently fixed; let users disable or scope it).
- **P4 — Custom TODO keyword sets.**
- **P5 — `orga` vs hand-roll decision.** Reopen if the chosen path hits ceilings.

### editor
- **E1 — Real org-mode Lezer grammar** for proper syntax highlighting.
- **E2 — Live block rendering / hide-markup-on-blur.**
- **E3 — Source-block code highlighting per language.**
- **E4 — Image and asset inline preview.**
- **E5 — Org-style heading cycling (TAB folds).**
- **E6 — Multi-buffer split panes.**

### vim
- **VIM-1 — `gnosis.vimrc` user config file** (vault-root-located vimrc-subset parser, leader override, custom maps, `gnoscommand` palette bridge).
- **VIM-2 — Macro persistence beyond named registers.**
- **VIM-3 — Link hints (Vimium-style `f` overlay) for sidebar items and inline links.**
- **VIM-4 — Visual-block mode in list views.**
- **VIM-5 — Count prefixes outside the editor** (`5j` in journal feed, etc).
- **VIM-6 — Custom operator-pending mappings** beyond what cm-vim's API supports natively.
- **VIM-7 — IME-on-mode-switch** (auto-switch OS input method to ASCII on entering NORMAL — Obsidian's `vim-im-select` parity).

### views & query
- **Q1 — Cross-vault search.**
- ~~Q2 — FTS5 full-text search~~ (LANDED IN MVP — see phase 2 + `06-database-schema.md`)
- **Q2b — FTS5 trigram tokenizer** for substring matches inside CJK / non-Latin scripts (MVP uses `unicode61`).
- **Q3 — Saved filters chip row** in each view.
- **Q4 — Pinning / starred blocks.**
- **Q5 — Tag autocomplete trained on the vault.**

### UI
- **U1 — Low-contrast theme.**
- **U2 — Zen / fullscreen reading mode.**
- **U3 — Native menus (macOS app menu).**
- **U4 — Tray icon.**
- **U5 — System notifications for due deadlines.**
- **U6 — Deeplinks (`gnosis://block/01J...`).**
- **U7 — Print / export to PDF.**

### build & release
- **B1 — macOS code signing + notarization, Windows EV cert.**
- **B2 — Auto-updater via `tauri-plugin-updater`.**
- **B3 — Full CI matrix (linux + windows + macos) and release pipeline.**
- **B4 — Reproducible builds.**

### testing
- **T1 — Playwright E2E with `tauri-driver`.** Promote out of nice-to-have once the macOS spike succeeds.
- **T2 — Bundle-size budgets in CI.**
- **T3 — Property-based tests for the parser.**
- **T4 — Mutation testing.**

### web & docs
- **W1 — Marketing landing page in `apps/web`.**
- **W2 — Docs content for `apps/docs`** (Fumadocs scaffold is ready).
- **W3 — Public release page on a custom domain.**

### mobile
- **M1 — Mobile app strategy.** Decide if `apps/mobile` is read-only viewer or full editor. Probably the former; org-mode editing on mobile is unkind.
- **M2 — Mobile capture share-sheet.**

### extensibility & sync
- **X1 — Public extension API.**
- **X2 — User-scriptable templates.**
- **S1 — Optional sync layer (hosted or BYO).**
- **S2 — Conflict-free CRDT-based collaborative editing.**

## smoke checklist for releases

A human runs through this before tagging a release:

1. Fresh install on a clean macOS user account.
2. Open app, pick a vault folder containing 5+ existing `.org` files (test corpus).
3. Verify the index runs, ULIDs are minted, the toast is honest about it.
4. Cmd+K → `j first journal entry`. Confirm in journal view.
5. Cmd+K → `t buy milk friday`. Confirm in todos kanban (Backlog or Active depending on date) and in agenda.
6. Click block in journal → editor jumps to source.
7. Edit a heading title in the editor. Wait 1 second. Refresh the journal view: title updated.
8. Toggle vim mode in settings. Re-open editor. Verify `i`/`Esc` works.
9. Quit. Re-launch. Tabs, scroll, last vault all restored.
10. Delete `gnosis.sqlite` while the app is closed. Re-launch. Cold index runs, content is intact, IDs were not re-minted (stable across rebuilds).
11. Pick a path with a space and unicode in it (`/tmp/Vault — Test/`). Repeat steps 4–6.

If all 11 pass, ship.

## decisions that diverge from the original BTS scaffold

Resolved with the user during planning revision. Listed here for traceability rather than as flagged deviations:

- **`apps/desktop` is Vite + React, not Next.js.** BTS attached Tauri to `apps/web` (Next.js). We split: `apps/desktop` is a fresh Vite app, `apps/web` stays Next.js as the landing page (deferred). Removes the entire `output: 'export'` / `reactCompiler` / `typedRoutes` / `next/image` problem class. See `03` and `12` for details.
- **No router in `apps/desktop`.** The shell is one screen; a router adds nothing. `apps/web` uses Next.js App Router on its own.
- **Strict vault scope** via a small custom Rust command (`set_vault_path`) that adds the user-picked directory to the Tauri FS scope at runtime. Broad-`$HOME` is documented as a fallback only. See `12-tauri-and-platform.md`.
- **Daily note path** is `daily/YYYY-MM-DD.org` (flat). No nested `YYYY/MM/`. See `04-vault-and-indexer.md`.
- **NL date parsing** uses `chrono-node`; results are normalized to org-mode active-timestamp syntax (`<YYYY-MM-DD Day HH:MM>`) by a `formatOrgTimestamp` helper before any splice. See `09-command-palette.md`.
- **First-run ID minting**: write immediately on first cold index, warn loudly in the first-run dialog and post-index toast. No dry-run preview. See `04-vault-and-indexer.md`.
- **Block-extraction palette command** stays in MVP. See `08-editor.md` and `09-command-palette.md`.
- **`apps/docs` is a sibling of `apps/web`.** The user's "apps/web/docs" wording was read as a list, not a nested path, given the explicit "we don't want Tauri and the landing page mixed" instruction.
- **`apps/mobile` ships as scaffold only** in MVP.
- **`tauri-plugin-store` dropped** in favor of an `app_state` SQLite table.
- **Vim mode is core, default-on**, not a setting buried in onboarding. The product is built for vim users; non-modal users disable it. See `15-vim-mode.md` for the full spec, the differentiation versus Obsidian's vim mode, and the deferred VIM-* issues.
- **The palette is the moat — and the entire UI surface.** No left sidebar. No file tree. No menu bar. Editor + right sidebar (views) + status bar are the only chrome. Outline lives in palette `o ` mode + editor folding. Block details live in an inline popover (`Cmd+Shift+I` / `Space i`). FTS5 is in MVP, not v0.2 — palette block search is on the hot path. See `09-command-palette.md` and `11-layout-and-shell.md`.
