# 11 — layout and shell

## the principle: minimal chrome, palette is the moat

gnosis ships almost no persistent UI. The user sees the editor, an optional right sidebar for views, and a thin status bar. There is no left sidebar. There is no file tree. There is no outline panel. There is no menu bar of buttons. Every navigation, command, and contextual action flows through the Cmd-K palette (see `09-command-palette.md`). The product principle is: if it isn't the notes themselves, it isn't on screen unless the user explicitly summons it.

## the two-pane shell

```
+------------------------------------------------------------------------+
| Title bar (Tauri-managed; productName "gnosis")                        |
+--------------------------------------------+---------------------------+
|                                            |                           |
|             CENTER (editor)                |   RIGHT (views)           |
|                                            |                           |
|  Buffer tabs: [today.org][parser.org][..]  |   Tabs: [Journal][Agenda] |
|  ────────────────────────────────────────  |   ──────────────────────  |
|                                            |                           |
|  CodeMirror viewport                       |   View body               |
|                                            |   (collapsible to 0)      |
|                                            |                           |
|                                            |                           |
|                                            |                           |
+--------------------------------------------+---------------------------+
| [NORMAL] g →   ~/notes  ·  Indexed 1,243 · idle                       |
+------------------------------------------------------------------------+
```

CSS Grid: `grid-template-columns: 1fr var(--right, 0); grid-template-rows: 1fr 24px;`. Two columns; left column owns the editor full-width when the right sidebar collapses to 0. One resize handle between editor and right sidebar.

## pane behavior

- **Center**: always the editor. Buffer tabs at top. Active is `bufferStore.activeBufferId`. Closing the last tab → empty state with welcome card and palette hint.
- **Right sidebar**: views only. Collapsible to zero width. Default 480 px when open, 0 px when closed. User-resizable to 720 px max. Persisted to `app_state`.
  - Default on first launch: collapsed. The user opens it via `Cmd+Shift+B`, `Space tr`, or `> Toggle right sidebar`.
  - Tabs at top: one per open view (Journal, Agenda, Todos). Multiple of the same kind permitted but the MVP UI only opens one of each.

There is no left sidebar. The keyboard shortcut formerly assigned to "toggle left sidebar" (`Cmd+B`) is repurposed (see "global keyboard shortcuts" below).

## what replaces the former left-sidebar tabs

| former tab | new home |
|-----------|----------|
| Outline | (a) editor folding via `zc/zo/za/zM/zR`; (b) `o ` palette mode listing headings of active buffer in document order |
| Block details | Inline popover triggered by `Cmd+Shift+I` (or `Space i` in vim NORMAL), anchored near cursor, read-only in MVP |

Both are documented in `09-command-palette.md` (outline mode, block-details popover) and `15-vim-mode.md` (vim chord bindings). Neither lives as persistent UI.

## resize handle

One vertical bar between editor and right sidebar. 6 px hit area, 1 px visible border. Hover thickens to a ring. Active drag: cursor `col-resize`. Drag-to-resize stores width to `app_state` debounced 500 ms. Double-click → toggle right sidebar collapsed/expanded.

## tabs

Two tab strips, same `Tab` component:

**Buffer tabs (center)**:
- File title (`#+TITLE:` if present, else basename without extension)
- Dirty indicator while pending write
- Right-click → palette commands scoped to that buffer (open, close, reveal, copy path…)

**View tabs (right sidebar)**:
- Kind label: "Journal", "Agenda", "Todos"
- Lucide icon for quick scanning

## status bar

24 px tall, bottom of viewport. Left to right:

- **Mode pill** — color-coded `NORMAL` / `INSERT` / `VISUAL` / `COMMAND` / `REPLACE` / `LIST` / `LEADER`. Colors per `16-design-system.md`. Always visible since vim is the default.
- **Chord-in-progress** — `g →`, `Space f →`, etc. Updates per keystroke. Helix-style which-key in the status bar.
- **Vault path** (truncated middle, right-anchored block).
- **Index status**: "Indexed 1,243 blocks · idle" or "Indexing... 312 / 980".

Right-click anywhere on the status bar → relevant palette commands.

The status bar is the only persistent affordance for global state. Everything else is hidden until invoked.

## first-run flow

1. Splash screen → "gnosis" logo + "Pick a vault folder."
2. User picks. Tauri checks write permission, scans, runs cold index in background, shows progress.
3. When done → shell opens with today's daily note in the center, right sidebar collapsed, mode pill on `INSERT` (cursor in editor, ready to type).
4. A toast offers: "Tip: Press ⌘K to do anything." (Capture, file open, view open, settings — palette covers it.)

If `meta.vault_root` already exists in `app_state` and the path is reachable, skip directly to step 3.

## tab switcher overlay (not the palette)

`Ctrl+Tab` opens a lightweight floating MRU buffer overlay (NOT the main palette). Hold `Ctrl`, tap `Tab` to cycle through open buffers in MRU order. Release `Ctrl` to confirm. VS Code pattern.

This lives in `apps/desktop/src/components/TabSwitcher.tsx` as a separate component with its own focus trap and `Ctrl+Tab` listener. ~100 lines. Documented separately from the palette in `09-command-palette.md`.

## global keyboard shortcuts (Cmd-style + vim chords)

| Combo | Vim chord | Action |
|-------|-----------|--------|
| Cmd+K | `Space Space` | Open palette (root) |
| Cmd+Shift+K | `Space c` | Open palette in capture mode |
| Cmd+P | (subset of `Space Space`) | Open palette in fileSearch mode (`f ` pre-typed) |
| Cmd+Shift+P | `:` (in editor) | Open palette in commands mode |
| Cmd+Shift+O | `Space o` | Open palette in outline mode |
| Cmd+Shift+I | `Space i` | Show block details popover for current block |
| Cmd+B | `Space b` | Open palette in blockSearch (re-purposed from old left-sidebar toggle, which no longer exists) |
| Cmd+Shift+B | `Space tr` | Toggle right sidebar |
| Cmd+Shift+\ | (palette-only) | Toggle palette preview pane |
| Ctrl+Tab | (hold-release) | MRU buffer overlay |
| Cmd+1..9 | `1gt`..`9gt` | Focus buffer N |
| Cmd+W | `:q` | Close active buffer (close window if last) |
| Cmd+Shift+T | `Space u` | Reopen last closed buffer |
| Cmd+, | `Space ,` | Open settings (via palette) |
| Esc | `Esc` | Pop focus stack |

There is no `Cmd+B` for "toggle left sidebar" because there is no left sidebar.

`Ctrl+W h` / `Ctrl+W l` move focus between editor and right sidebar (`Ctrl+W l` = right, `Ctrl+W h` = back to editor).

All shortcuts have palette-command equivalents. None of them is the only way to do something.

## focus stack

Esc has one job globally: pop the top of the focus stack. Stack order top-to-bottom:

1. Action sub-list (palette Tab sub-menu)
2. Palette filter input (INSERT)
3. Palette result list (LIST)
4. Block-details popover
5. Settings modal
6. Vault picker
7. Tab-switcher overlay
8. Visual-mode selection (editor)
9. Right sidebar focused
10. Editor (default bottom layer)

Implementation lives in a single document-level keydown listener at the React root in capture phase. Third-party modal libraries (Radix, Base UI inside `@gnosis/ui`) get their `onEscapeKeyDown` handlers stubbed so we route everything through the stack. Detail in `15-vim-mode.md`.

## theming

`packages/ui` already provides Tailwind v4 + shadcn `base-lyra` style with neutral baseColor. We extend with:

- A dark theme tuned for long reading.
- A "low-contrast" optional theme (deferred — issue U1).
- Semantic tokens defined in `16-design-system.md` (mode colors, view tokens, editor tokens).

Theme toggling via palette command `Toggle theme`. `apps/desktop` (Vite + React) implements its own tiny theme provider on top of `prefers-color-scheme` plus Tauri's `theme()` API.

## responsive behavior

The desktop window is resizable. Below 800 px wide, the right sidebar auto-collapses; the user must reopen it manually. We don't reflow into mobile-style stacked panes — that's an `apps/mobile` concern.

## what we are NOT building in the shell

- **No left sidebar.** Period. Not now, not later — the architecture rejects it.
- **No file tree.** Files are reached through palette + frecency-based recents.
- **No menu bar of buttons.** All actions are palette commands.
- **No multi-window support** in MVP.
- **No splits inside the editor pane.** One buffer visible at a time. (Split panes is issue E6.)
- **No "zen mode"** / fullscreen reading view (issue U2).
- **No customizable layout per workspace.**
- **No tab groups, no pinned tabs.**

## known unknowns

- **CSS Grid panes vs `react-resizable-panels`.** Plain Grid + a tiny custom resize hook is enough. If we hit edge-case bugs (touch devices, RTL), pull `react-resizable-panels`.
- **Settings as a modal vs a route.** Modal in MVP. If the settings surface grows past five tabs, revisit.
- **Right sidebar default-collapsed.** Pro vim users likely never open it; mouse-first users want it default-open. Resolution: collapsed on first launch, "show me how to open it" toast covers the discoverability gap. Persist after the first toggle.
