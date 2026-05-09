# 15 — vim mode (core, default-on)

## thesis

gnosis is a vim-first app. Vim mode is the default. The setting is "vim mode is on" — there is no separate "enable vim" toggle in onboarding. Users who want non-modal editing flip it off in settings, but the product is built for the people who flip it on first thing in every other tool. That includes navigation outside the editor: lists, palette, sidebars, tabs all respond to motion keys.

Two competitors set the bar:

- **Obsidian's vim mode**, which is good inside the editor and bad everywhere else. We aim higher than the editor.
- **Helix**, which proves modal-everywhere is teachable and pleasant if mode transitions are announced visually and the chord vocabulary is consistent.

This doc is the contract for what "vim-first" means in MVP.

## the library

`@replit/codemirror-vim` v6.3.0 (or current). It is the only viable CM6 vim layer in 2026. Alternatives (`vim.wasm`, hand-rolled CM5 ports) are dead or unrealistic.

Imported **statically**, not lazily, in `packages/editor`. Vim is on for every editor instance from frame zero. Bundle weight (~60–80 KB gzipped) is fine.

Custom commands and motions are registered through the package's public API: `Vim.defineEx`, `Vim.map`, `Vim.noremap`, `Vim.defineOperator`, plus access to the underlying state via `getCM(view)?.state.vim`.

## three vim surfaces

gnosis has three places that respond to modal keys. Each has a different runtime owner.

| surface | who owns keys | mode source |
|---------|---------------|-------------|
| **editor pane** (CodeMirror) | `@replit/codemirror-vim` | per-editor vim state machine |
| **palette / modals** (cmdk dialog) | custom React handler | global `vimStore.mode` |
| **panels / lists** (right sidebar, tabs, palette LIST mode) | custom React handler via `tinykeys` | global `vimStore.mode` |

The unification: a global `vimStore` (Zustand) holds the current mode, the current chord-in-progress, and the focus stack. The editor reads its own mode locally; the global store mirrors it via the `vim-mode-change` event (with a CM `updateListener` fallback because the event has known reliability gaps — see `known unknowns`).

## modes we model

`NORMAL`, `INSERT`, `VISUAL`, `VISUAL-LINE`, `VISUAL-BLOCK`, `COMMAND`, `REPLACE`, plus the gnosis-specific `LIST` (when focus is in a sidebar list) and `LEADER` (transient, while a chord prefix is captured).

`LIST` is not a real vim mode — it is what we call the modal-navigation state in panels. Behaves like NORMAL but with sidebar-relevant bindings (see "lists and panels" below).

## the leader

`Space`. Hardcoded for MVP. User overrides arrive in v0.2 via `gnosis.vimrc` at vault root (deferred — issue VIM-1).

`Space Space` opens the command palette anywhere. `Space f` opens file search. `Space b` opens block search. `Space j/t/n` opens journal/task/note capture. `Space v j/a/t` opens journal/agenda/todos views. The full leader map is the same set of commands the palette exposes; the palette is the canonical command list.

A which-key popup appears 300 ms after the leader is pressed if the chord is incomplete. Power users never see it (their next key arrives within 300 ms). Newcomers always see it. The popup renders as a small overlay anchored bottom-center, listing remaining options with one-line descriptions.

## inside the editor — what we ship beyond cm-vim defaults

The library provides standard vim. We layer org-aware additions on top.

### shipped vimrc-equivalent (baked in)

These behaviors are on by default and not configurable in MVP:

```
" yank/paste use the system clipboard
set clipboard=unnamed

" search is case-insensitive unless capitals appear
set ignorecase
set smartcase

" no highlight after Esc clears selection
" (we wire :nohlsearch to Esc in normal mode)

" mapleader is Space
" leader maps live in the global handler, not in cm-vim,
" so they work outside the editor too

" tab keys for buffer navigation
nmap gt :tabnext<CR>
nmap gT :tabprev<CR>

" folding (we implement these natively, not via exmap)
nmap zc <fold-close>
nmap zo <fold-open>
nmap za <fold-toggle>
nmap zM <fold-all>
nmap zR <fold-none>

" pane navigation
nmap <C-w>h <pane-left>
nmap <C-w>l <pane-right>
nmap <C-w>j <focus-status>     " (advisory; rarely used)

" org motions
nmap ]] <next-heading-any-level>
nmap [[ <prev-heading-any-level>
nmap ]h <next-sibling-heading>
nmap [h <prev-sibling-heading>
nmap ]c <next-todo-block>
nmap [c <prev-todo-block>
```

These are not stored in a config file in MVP — they are TypeScript constants that wire into cm-vim at editor boot. Doing it in code (vs. parsing a vimrc) is faster to ship and easier to test.

### custom ex commands — the palette bridge

Typing `:` in the editor opens cm-vim's command-line. We register a long list of ex commands that mirror palette actions:

| ex | shorthand | does |
|----|-----------|------|
| `:capture` | `:cap` | open palette in capture mode |
| `:journal {text}` | `:j` | journal capture inline |
| `:task {text}` | `:t` | task capture inline (chrono-node) |
| `:done` | `:do` | mark current heading DONE |
| `:todo` | `:to` | mark current heading TODO |
| `:schedule {date}` | `:sch` | set SCHEDULED on current block |
| `:deadline {date}` | `:dl` | set DEADLINE on current block |
| `:tag {name}` | `:ta` | add tag to current block |
| `:untag {name}` | — | remove tag |
| `:priority {A\|B\|C\|none}` | `:pri` | set priority cookie |
| `:extract` | `:ex` | extract subtree to new file |
| `:open {path}` | `:o` | open a file by path |
| `:search {q}` | `:s` (taking precedence over `:%s` only outside of `:%s/.../` shape) | block search |
| `:view {journal\|agenda\|todos}` | `:v` | open a view tab |
| `:vault` | — | switch vault (warns + restarts) |
| `:settings` | `:set` (partial — true `:set foo=bar` still works) | open settings |
| `:reindex` | — | manual cold index |
| `:nohl` | — | clear search highlight |
| `:q` | — | close current buffer; close window if last buffer |
| `:wq`, `:x` | — | aliases for `:q` (writes are automatic) |

Every ex command has an equivalent palette command. The discipline from `09-command-palette.md` holds: every action is reachable both ways.

When `:` opens the cm-vim command line, we also pop a small completion list anchored under the line so the user sees the available ex commands as they type. This is gnosis-custom — cm-vim does not provide it.

### org-aware text objects

`ih` / `ah` — inner / a heading (heading body excluding / including the heading line and trailing blank).
`id` / `ad` — inner / a properties drawer.
`it` / `at` — inner / a tag list on the heading line (the `:foo:bar:` region only).

These are implemented via `Vim.defineOperator`-friendly helpers that compute selection ranges using `@gnosis/core`'s parsed AST plus byte offsets. Whatever cm-vim provides for `iw`/`aw`/`i"`/`a"` etc. stays.

### org-specific motions

`]]` / `[[` — next / prev heading at any depth.
`]h` / `[h` — next / prev heading at same depth.
`]c` / `[c` — next / prev TODO heading (regardless of state).
`]p` / `[p` — next / prev block with a deadline within the lead time.

Implemented in TypeScript using parsed block ranges from `@gnosis/core`; cm-vim's motion API takes a function that returns the new cursor.

## outside the editor — the global vim handler

A single React-root keydown listener (built on `tinykeys`) handles keys whenever no editor and no input has focus. It is the second-class vim engine: smaller vocabulary, but consistent semantics with cm-vim.

### list-mode bindings (panels and views in `LIST` mode)

| key | does |
|-----|------|
| `j` / `k` | move item cursor |
| `gg` / `G` | jump to top / bottom |
| `Ctrl-d` / `Ctrl-u` | half-page down / up |
| `/` | enter inline filter (pseudo-INSERT for filter input) |
| `Enter` or `o` | open selected (Enter = current pane, `o` = new tab) |
| `x` | mark TODO ↔ DONE on the focused block (in todos/agenda) |
| `dd` | archive / delete the focused row (with undo) |
| `v` | start visual multi-select |
| `Space` then chord | leader chord, same as everywhere |
| `Esc` | exit filter to list-nav, or pop focus stack |
| `Tab` / `Shift-Tab` | move between sidebar tabs |
| `q` | close the focused panel (e.g., close a view tab) |

### palette in modal mode

Palette opens in INSERT (cursor in filter field). `Esc` switches to LIST mode (j/k navigates results without typing). This is the telescope.nvim two-state picker pattern; users who want it can stay typing, users who want vim get it.

### global navigation chords

| chord | does |
|-------|------|
| `gt` / `gT` | next / prev buffer tab |
| `gd` | go-to-definition equivalent: open block under cursor (link follow) |
| `gj` / `gk` | display-line down / up (in editor only — passthrough to cm-vim) |
| `Ctrl-w l` | focus right sidebar from editor (no left sidebar exists) |
| `Ctrl-w h/l` | focus editor from a sidebar (mirror) |
| `Ctrl-w o` | "only" — collapse both sidebars, focus editor |

### the focus stack

We maintain an ordered stack of UI layers. Esc pops the top:

```
[ palette (modal) ]
[ vault picker ]
[ settings panel ]
[ filter input on a list ]
[ visual-mode selection ]
[ sidebar focused ]
[ editor (default bottom layer) ]
```

The handler that owns Esc lives at the React root. Third-party modal libraries (Radix, Headless UI inside `@gnosis/ui`) get their `onEscapeKeyDown` handlers stubbed so we route everything through the stack.

## mode indicator UX

A single mode pill in the bottom-left of the status bar. Color-coded:

| mode | color | label |
|------|-------|-------|
| NORMAL | blue | `NORMAL` |
| INSERT | green | `INSERT` |
| VISUAL / VISUAL-LINE / VISUAL-BLOCK | amber | `VISUAL`, `V-LINE`, `V-BLOCK` |
| COMMAND | purple | `COMMAND` |
| REPLACE | red | `REPLACE` |
| LIST | gray | `LIST` |
| LEADER | gray with cursor underline | `LEADER` |

Right of the pill: the **in-progress chord** (e.g., `g →`, `Space f →`). Updates on every keystroke. Helps both learners and pros (you see when a chord is registering).

Cursor shape:
- NORMAL → block
- INSERT → bar
- REPLACE → underline
- VISUAL → block with selection background

In CodeMirror this is enabled by cm-vim's built-in cursor decorations. Outside the editor, the focused list item gets a "current row" highlight class — the cursor is not positionally rendered.

## persistence (across launches)

We persist more than Obsidian does:

- **Last cursor and scroll** per buffer (already in plan from doc 11).
- **Marks** — `'a`–`'z` (single-file) and `'A`–`'Z` (cross-file global). Stored in `app_state.vim_marks` keyed by mark letter; on file open, restored before user interacts.
- **Search history** — last 50 `/` and `?` queries. Stored in `app_state.vim_search_history`.
- **Registers** — named registers `"a`–`"z` survive restart. Stored in `app_state.vim_registers`. (Anonymous register, clipboard registers, and 0-9 numbered registers are session-scoped — that matches every other vim.)
- **Macros** — `q{a}` recordings persist as register contents. Same store as registers.

Implementation: a tiny `vimPersistence` adapter in `packages/editor` exposes `serialize(view)` and `hydrate(view, snapshot)`. We call serialize on app `blur`/`beforeunload` and hydrate after editor mount.

## the gnosis.vimrc file (deferred)

User-overridable keymap and `set` options shipped in v0.2 (issue VIM-1). For MVP, defaults are baked in. The format will be a minimal subset of vimrc syntax (`map`, `nmap`, `imap`, `unmap`, `set option=value`, `let mapleader=...`, `source other.vimrc`) plus gnosis-specific `gnoscommand` (analog of Obsidian's `obcommand`) that lets you bind any palette command id to a key. We commit to this schema in `14-roadmap-and-deferred.md` so existing configs forward-port.

## what gnosis does that Obsidian does not

| Obsidian gap | gnosis fix in MVP |
|--------------|---------------------|
| Vim is opt-in | Vim is on by default |
| Yank goes to vim register, not clipboard | `clipboard=unnamed` baked in |
| `gt`/`gT` not native | Native, in default vimrc |
| `zc`/`zo`/`za`/`zM`/`zR` unimplemented | Native fold ops wired to outline |
| `:` does not open palette | `:` opens cm-vim command line; gnosis ex commands include the entire palette surface |
| No `j/k` in sidebars / search results / views | Global `LIST` mode handles right sidebar, palette result list, and all view rows |
| No global marks across files | Persisted per-mark to SQLite |
| No mode indicator with chord-in-progress | Status bar pill with color + chord readout |
| No which-key popup | 300 ms popup with grouped chord hints |
| Files-tree-as-noise | No file tree at all; palette `f ` + recents replace it |
| Block metadata sidebar always present | `Space i` inline popover, dismissed on Esc |

Obsidian's vim plugin ecosystem (`obsidian-vimrc-support`, `obsidian-vim-yank-highlight`, `obsidian-vim-im-select`, `obsidian-sidebar-keyboard-navigation`) collectively does a chunk of this. We absorb that work as first-class behavior.

## tauri-specific concerns

- **`tauri-plugin-prevent-default`** is added to the desktop app. Disables `Cmd+R` (reload), `Cmd+F` (browser find), context menu, dev-tools shortcut. Without it, the user's vim Cmd-key chords leak to the webview.
- **`Cmd+W`** is special. macOS routes it before the webview sees it. We capture it via Tauri's Rust `WindowEvent::CloseRequested` handler and route through our buffer-close logic. If the last buffer would close, the window closes; otherwise the buffer closes. (Neovim pattern.)
- **`Cmd+Q`** passes through to the OS — quitting the app. We do not intercept.
- **IME composition** — wrap the editor in `compositionstart` / `compositionend` listeners that suspend vim normal-mode key handling during composition. Otherwise CJK / accent input fights normal mode.
- **Window did-finish-load** — fire `window.focus()` on Tauri's `did-finish-load` so keyboard events arrive without a first click.

## yank highlight

When `y{motion}` completes, briefly flash the yanked range with a subtle background tint, ~250 ms. Custom CodeMirror decoration. Trivial — but every vim user notices its absence.

## file watcher interaction (foreshadow)

When the file watcher lands (issue V2 in `14-roadmap-and-deferred.md`), an external write to a buffer-open file invalidates the buffer. The vim state reset happens locally; marks and registers carry. Documented now so we don't re-derive later.

## interface in `packages/editor`

```
<EditorPane bufferId={...} />
<BlockSnippet text={...} />            // unchanged from doc 08
<ModePill />                            // shows the current mode + chord
<WhichKeyPopup />                       // global, anchored bottom-center

// Re-exported from the package
export { Vim } from "@replit/codemirror-vim"
export { vimPersistence } from "./vim-persistence"
export { defineGnosisExCommands } from "./gnosis-ex"   // called once at app boot
```

## known unknowns

- **`vim-mode-change` event reliability.** Issue #251 in cm-vim notes the event does not always fire on every transition. Resolution: subscribe to it AND poll `(getCM(view)?.state as any).vim?.mode` in a CM6 `updateListener`. Diff on change.
- **`Vim.defineTextObject` API stability.** Underdocumented. We may end up implementing org text objects via custom operators that compute selection ranges directly, bypassing the formal text-object API.
- **Esc race conditions** with Radix. Our focus-stack handler attaches at the document level in capture phase; Radix attaches in bubble phase. If Radix still wins on some component, we wrap that component to suppress its `onEscapeKeyDown`.
- **Multi-file global marks** require knowing the file path at mark-set time and being able to open it on jump. Fine — `bufferStore.openBuffer` exists. The risk is performance if the marks reference files that have moved; we resolve to "mark stale, beep, log a warning" rather than failing loudly.
- **`tinykeys` chord timeout** defaults to 1000 ms. We tune this; 1000 ms feels long. 750 ms is a reasonable default; let it be configurable in `gnosis.vimrc` v0.2.
- **Yank to system clipboard via Tauri.** `navigator.clipboard.writeText` works in webviews but requires a user gesture in some browsers; in Tauri, gesture restrictions are typically lifted. Verify on phase 5; fallback is `tauri-plugin-clipboard-manager`.

## what is NOT in this plan (deferred)

- **`gnosis.vimrc` user config file.** Issue VIM-1.
- **Macro persistence beyond named registers.** Issue VIM-2.
- **Link hints (`f`-key Vimium-style overlay).** Issue VIM-3.
- **Visual-block mode in list views.** Issue VIM-4.
- **Count prefixes outside the editor** (e.g., `5j` in the journal feed). Issue VIM-5.
- **Custom operator pending mappings beyond what cm-vim supports.** Issue VIM-6.
- **Real Lua / Vimscript engine.** Never. The vimrc subset is bespoke and that's fine.

## test approach

- **Unit:** every custom ex command has a Vitest test that opens a known fixture, runs the command, asserts on the resulting AST or buffer text.
- **Mode transitions:** snapshot the `vimStore.mode` after a scripted key sequence. Asserts catch silent regressions in the cm-vim ↔ store bridge.
- **Focus stack:** a small DOM-driven test harness that mounts the shell with synthetic panels, fires Esc, verifies the right layer pops.
- **End-to-end:** a Playwright script (deferred to E2E in `13-build-test-tooling.md`) that drives a real Tauri webview through the user-flow checklist with vim keys only.
