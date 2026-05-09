# 09 — command palette (the moat)

## thesis

The palette is the entire app's command surface. Editor + right-sidebar views + status bar are the only persistent UI; everything else — file open, content search, capture, command execution, tab switch, outline jump, settings, view open, contextual actions on a result — flows through Cmd+K. There is no left sidebar, no file tree, no outline panel, no menu bar of buttons. If a feature can't be reached from the palette, it isn't a feature.

This is the moat. Competitors (Obsidian, Logseq, Bear) all add UI for every feature; gnosis adds a provider.

## stack

| layer | choice | reason |
|-------|--------|--------|
| ARIA + filter shell | `cmdk` v1.1.x via shadcn `Command` (already in `@gnosis/ui`) | Headless, a11y-correct, shadcn-compatible, ~4 KB gzipped, battle-tested |
| Virtualization | `@tanstack/react-virtual` v3.x | Required for high-cardinality providers (5–10k+ block search results); cmdk has no built-in virtualization |
| Provider registry | hand-rolled `PaletteRegistry` context (~80 lines) | Per-mode scoping; we don't need kbar's global registry pattern |
| Mode state machine | `useReducer` (~100 lines) | Deterministic INSERT / NORMAL / SUB:* transitions; one file |
| Vim normal-mode layer | custom `keydown` handler (~40 lines) | No library covers `j/k/gg/G` navigation natively |
| Frecency ranking | hand-rolled `useFrecency()` hook (~30 lines) | Raycast-style frequency × recency; one map persisted to `app_state` |

`kbar` was evaluated and rejected — perpetual beta, slow-moving, global-registry pattern conflicts with per-mode provider scoping. `ninja-keys` is dead. `Base UI` ships no `Command` component as of 2026.

For high-cardinality providers (`fileSearch`, `blockSearch`, `outline`) we set `shouldFilter={false}` on `<Command>` and render a `useVirtualizer`-driven list inside `<Command.List>`. Filtering happens in the async loader (SQLite FTS5; see `06-database-schema.md`).

## the provider model

```
type Provider = {
  id: string                       // 'commands' | 'fileSearch' | 'blockSearch' | 'capture' | 'view' | 'templates' | 'outline' | 'recentFiles' | 'tabs' | 'settings'
  trigger?: string                 // optional prefix like '>' | 'f ' | 'b ' | 'o '
  scope: PaletteMode | PaletteMode[]  // which modes this provider participates in
  rank: number                     // ordering when multiple providers fire in root mode
  match(query: string, ctx: Ctx): boolean
  results(query: string, signal: AbortSignal, ctx: Ctx): Promise<Item[]>
  preview?: (item: Item) => ReactNode    // optional right-pane preview
  actions?: (item: Item, ctx: Ctx) => ItemAction[]    // contextual actions opened by Tab
  onSubmit(item: Item, ctx: Ctx): Promise<void>
  empty?: ReactNode
}

type Item = {
  id: string                       // stable for frecency
  label: string
  detail?: string
  icon?: ReactNode
  meta?: Record<string, unknown>
}

type ItemAction = {
  id: string                       // stable
  label: string
  shortcut?: string                // single letter, displayed inside the sub-list
  run(item: Item, ctx: Ctx): Promise<void>
}
```

Providers register themselves at module load via `paletteRegistry.register(provider)` from a `useEffect` in their owning module (capture, file, block, etc.). The palette engine iterates the registry on each query — flat O(n) over n=10 providers per keystroke, fine.

## MVP providers (10)

| id | trigger | root? | preview | tab actions | notes |
|----|---------|-------|---------|-------------|-------|
| `commands` | `>` | yes | no | no | All registered commands |
| `fileSearch` | `f ` | yes | yes (first 20 lines) | yes | All `.org` files |
| `blockSearch` | `b ` | yes (FTS5) | yes (block + ancestor) | yes | Full-text via FTS5 |
| `recentFiles` | none | yes (low rank) | yes | yes | MRU file list |
| `capture` | `j ` `t ` `n ` | no | no | no | Inline capture sub-modes |
| `view` | `v ` | no | no | no | Open journal/agenda/todos |
| `templates` | `tpl ` | no | no | no | User capture templates |
| `outline` | `o ` (or `Cmd+Shift+O`) | no | no | no | Headings of active buffer, doc order |
| `tabs` | none | no | no | no | Programmatic only; primary UX is `Ctrl+Tab` overlay (see below) |
| `settings` | none | no | no | no | Surfaced through `commands` only (`> open settings`, `> set vim …`) |

`recentFiles` and `tabs` ranks below user input in root mode so a fresh query doesn't drown in MRU noise. Empty query → recents shown.

## prefix conventions

| Prefix | Mode | Lineage |
|--------|------|---------|
| `>` | Commands | VS Code / Sublime universal convention |
| `f ` | File search | gnosis convention; space separator |
| `b ` | Block search (FTS5) | gnosis; space separator |
| `j ` | Journal capture | gnosis |
| `t ` | Task capture | gnosis (longest-prefix match resolves vs `tpl`) |
| `n ` | Note capture | gnosis |
| `v ` | View open | gnosis |
| `tpl ` | Template | gnosis |
| `o ` | Outline of active buffer | gnosis (replaces former left-sidebar outline tab) |
| `?` | Inline help card | VS Code; no space needed |

## the help card (`?` prefix)

Typing `?` produces a single inline result card listing every prefix with one-line descriptions and an example. No modal, no docs link. Cheapest possible discoverability win — users who typed `?` by accident still get something useful.

## contextual actions — `Tab` opens an action sub-list

When a result is highlighted, pressing `Tab` opens an inline sub-list of actions for that item. `Esc` pops back to the main result list. Each action gets a single-letter shortcut shown on the right of its row.

Examples:

**File result (`fileSearch`):**
- `o` Open in current tab (also Enter)
- `n` Open in new tab
- `r` Reveal in OS file manager (`tauri-plugin-opener`)
- `c` Copy path
- `t` Copy title
- `d` Delete… (confirms)

**Block result (`blockSearch`):**
- `o` Jump to block (also Enter)
- `c` Copy block text
- `i` Copy block ID
- `d` Mark DONE / TODO toggle (if a TODO block)
- `s` Set deadline…
- `g` Set tag…

**Command result:**
- No Tab sub-list. Enter runs the command.

**Outline result:**
- `o` Jump to heading (also Enter)
- `c` Copy heading link `[[file::id][title]]`
- `e` Extract subtree to new file…

We use `Tab`, not Raycast's `Cmd+K`-within-`Cmd+K`. `Cmd+K` is the global open shortcut and reusing it as "actions for selected" creates two meanings for one key. Alfred's `Tab`-on-result pattern is cleaner.

## preview pane

Providers with `preview` defined render a right-side preview panel (max 320 px wide, collapsible via `Cmd+Shift+\` or palette command).

- **fileSearch** — first 20 lines of the file, mono font, syntax-highlighted via `BlockSnippet`.
- **blockSearch** — the block's full body plus heading ancestor breadcrumb (`Parent › Child › Title`).
- **recentFiles** — same as `fileSearch`.

For commands, capture, view, templates, outline → no preview. Pane collapses; result list expands.

The preview is a quality-of-life feature for navigation. It is NOT used for editing or for previewing capture targets.

## ranking — frecency + relevance

Per Raycast's `useFrecencySorting`. We track `{ itemId → { count, lastVisitedMs } }` in `app_state.palette_frecency`, scoped by provider id (file frecency separate from command frecency).

Score = `count * decay(now - lastVisitedMs)`, where `decay(ms) = 1 / (1 + ms / (7 * day))` — half-life ~7 days. Plus the provider's own relevance score from FTS5 (BM25) or fuzzy match.

Final ordering for root mode:
1. Exact-match commands.
2. Frecency-boosted commands.
3. File matches (title before path), frecency-boosted.
4. Block matches (title before body), BM25-ranked.
5. Recent files (low rank, only when query is empty).

Aliases boost match probability — see "command registry" below.

## the command registry (with aliases)

```
type Command = {
  id: string                       // 'block.markDone', 'view.openJournal'
  label: string
  aliases?: string[]               // ['archive', 'finish', 'complete']
  hint?: string                    // shown on right
  shortcut?: string                // displayed; bound separately
  shouldShow?: (ctx) => boolean
  run(ctx): Promise<void> | void
}
```

Aliases let "done" find "Mark as DONE", "modal" find "Toggle vim mode", "find" find "Block search". Adds discoverability without bloating labels. Per Superhuman's lessons.

`ctx` carries: active buffer id, selected block id, vault root, store handles. Commands mutate stores; they don't touch the DB directly.

## tab switching policy

Two paths.

1. **`Cmd+1..9` / `1gt`–`9gt`** — direct numeric access to open buffer N.
2. **`Ctrl+Tab` overlay** — a separate floating component (NOT the palette). Hold `Ctrl`, tap `Tab` repeatedly to cycle through MRU buffer order. Release `Ctrl` to confirm. VS Code's hold-and-release pattern. Lives in `apps/desktop/src/components/TabSwitcher.tsx`. Standalone focus trap, ~100 lines.

The `tabs` provider exists for programmatic access (`> Switch to tab: today.org`) but the primary UX is the overlay. No `tab ` prefix in the palette — it would duplicate what `Ctrl+Tab` does better.

## outline (replaces former left-sidebar tab)

The left sidebar is gone (see `11-layout-and-shell.md`). Outline lives in two places:

1. **Editor folding** — keyboard-driven heading collapse via `zc/zo/za/zM/zR` (see `15-vim-mode.md`).
2. **`o ` palette mode** — type `o ` and the palette shows all headings of the active buffer in document order, with depth-indented labels:
   ```
   #   parser overview
     ##  tokenizer
       ### state machine
     ##  emitter
   #   testing
   ```
   No fuzzy ranking — document order is correct for headings. Filtering still works (typing narrows the list). Enter scrolls editor to the heading and closes palette.

## block details (replaces former left-sidebar tab)

Inline popover, not a palette mode. Triggered by `Cmd+Shift+I` (or `Space i` in vim normal). Anchors near the cursor (auto above/below depending on viewport). Read-only in MVP. Shows:

- Block ID
- Heading path: `Parent › Child › Current`
- Tags
- TODO state, priority
- SCHEDULED / DEADLINE timestamps
- Created at

Dismiss with `Esc`. Editing the block goes through the editor or via `:done`, `:schedule`, etc. ex commands.

This is closer to VS Code's hover-symbol popover than to a command palette item. The palette is for navigation and actions; metadata display is presentation.

## flows

### capture

1. Cmd+K → palette opens, mode = `root`, query empty.
2. User types `j thoughts on the parser`.
3. `capture` provider matches `j ` prefix. Renders one item: `Journal: thoughts on the parser`. Detail: target file (`daily/2026-05-09.org`) and tags (`:journal:`).
4. Enter → `core.captureJournal({ text })` → file appended → indexer incremental → palette closes.
5. Toast confirms. Right sidebar journal view (if open) shows the new entry within ~80 ms.

Capture types:
- `j` → journal: tags `:journal:`, body = query.
- `t` → task: chrono-node parses date phrases, normalized to org timestamp; produces `* TODO ...` with `SCHEDULED:`. See `05-org-parser.md` and `15-vim-mode.md`.
- `n` → note: free heading, no tag, target = today's daily by default.

### file search

`f mark` → up to 50 results from `files` table (or via `recentFiles` boosted). Preview pane shows first 20 lines. Tab opens action sub-list. Enter opens in current tab; `o` (action) opens in new tab.

### block search (FTS5)

`b parser` → up to 50 results from `blocks_fts` virtual table, BM25-ranked. Preview pane shows full block body + ancestor breadcrumb. Enter jumps editor to source. Performance budget: <10 ms at 100k blocks (FTS5 territory).

### outline

`o ` → all headings of active buffer in document order. Depth-indented. Enter scrolls editor to heading.

### recent

Empty query → up to 10 recent files (frecency-ranked) shown. Enter opens. Provides instant value when the palette opens with nothing typed.

### view open

`v journal` → opens the journal view tab in the right sidebar. `v agenda` → agenda. `v todos` → todos. If a tab of the same kind exists, focus instead of duplicate.

### commands

`>` lists registered commands by frecency + alias matching. Same set as before, plus everything that used to be a sidebar/menu action:

- `Refresh index`
- `Switch vault…`
- `Toggle vim mode`
- `Toggle right sidebar`
- `Toggle palette preview pane`
- `Reveal active file in OS file manager`
- `Mark current block as DONE`
- `Set deadline on current block…`
- `Set tag on current block…`
- `Set priority on current block…`
- `Extract subtree to new file…`
- `Show block details` (also `Cmd+Shift+I`)
- `Open settings`
- `Quit`

Every action in the app must show up here. Buttons in the UI MUST have a corresponding command id. Discipline: any new feature ships with its palette command in the same PR.

## keyboard inside the palette

INSERT (cursor in filter, default on open):

| Key | Action |
|-----|--------|
| Up/Down or Ctrl-n/p | Move selection |
| Enter | Submit (run primary action) |
| Tab | Open contextual action sub-list for selected item |
| Esc | Switch to LIST mode (still in palette) |
| Cmd+Backspace | Clear filter |
| Cmd+Shift+\ | Toggle preview pane |

LIST (after first Esc):

| Key | Action |
|-----|--------|
| `j` / `k` | Move selection |
| `gg` / `G` | Jump to first / last result |
| `Ctrl-d` / `Ctrl-u` | Half page |
| Enter or `o` | Submit |
| `Tab` | Open action sub-list |
| `i` or `/` | Return to INSERT |
| Esc | Close palette (pop focus stack) |

Inside an action sub-list:

| Key | Action |
|-----|--------|
| (single letter) | Run that action |
| Up/Down or `j`/`k` | Move selection |
| Enter | Run highlighted action |
| Esc | Back to result list |

## empty state

```
> command       f file        b block (grep)
o outline       j journal     t task
n note          v view        tpl template
?  help

⌘K to toggle · Esc to close · Tab for actions · ⌘⇧\ for preview
```

Below the grid: 5 most-recent files (frecency).

When the vault has fewer than 3 blocks: replace recents with "Welcome — try `j hello world`".

## known unknowns

- **FTS5 ranking quality on short queries.** BM25 is good for >=2-token queries; for single-token prefix matches we may want a hybrid (FTS5 prefix match boosted by frecency). Resolution: measure during phase 4. Tunable post-MVP.
- **Preview pane perf with large files.** Loading the whole file just to show 20 lines is wasteful. Resolution: read file with a byte cap (`tauri-plugin-fs` allows partial reads via length param). Falls back to "(file too large to preview)" >2 MB.
- **`Tab` key conflict.** cmdk's default treats Tab as cycle. We override to "open action sub-list." Verify cmdk allows this without forking; if not, intercept at the document level.
- **Action sub-list collisions on single-letter shortcuts.** Action shortcuts may collide with vim-mode keys (`o`, `i`, etc.) when sub-list is open. The sub-list owns keys while it's open — vim handler suspends. Document the precedence in `17-keymap-reference.md`.

## what's NOT in the palette in MVP

- No agent / LLM commands.
- No multi-step wizards beyond template selection.
- No drag-drop between palette items.
- No pinning of palette items.
- No persistent provider selection across opens (always start in root).
- No telemetry.

## the discipline

Adding a feature elsewhere that isn't reachable from the palette is a smell. Every PR must answer "what palette command exposes this?" If the answer is "none", either add one or rethink. The status bar is the single visible chrome; the palette is everything else.

## ex command bridge (vim users)

`:` in the editor opens cm-vim's command line. Every palette command id is mirrored as an ex command (`:capture`, `:done`, `:journal foo`, `:view agenda`, …). Full table in `15-vim-mode.md` and `17-keymap-reference.md`. The palette and the ex command line are two front doors to the same command registry.
