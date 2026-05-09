# 16 — design system

## why this doc

Visual specs were scattered across `08-editor.md`, `09-command-palette.md`, `11-layout-and-shell.md`, and `15-vim-mode.md`. This doc consolidates them so a designer or implementer has one place to see the system and so we don't drift across docs as we revise. The `packages/ui` foundation (shadcn `base-lyra` + Base UI primitives + Tailwind v4) stays.

This is design intent, not CSS. We pick token names, component patterns, and rules. Implementation lands in `packages/ui` during phase 8.

## color tokens

Layered on top of the shadcn `base-lyra` neutral palette already in `packages/ui/src/styles/globals.css`. We add semantic tokens; we don't replace the base palette.

### mode tokens (status bar pill, focus accents)

```
--mode-normal      = blue-500   (light) / blue-400  (dark)
--mode-insert      = green-500            green-400
--mode-visual      = amber-500            amber-400
--mode-command     = violet-500           violet-400
--mode-replace     = red-500              red-400
--mode-list        = neutral-500          neutral-400
--mode-leader      = neutral-500          neutral-400  (with cursor underline)
```

Each pill renders with the mode token as background, white-or-dark foreground depending on contrast. Numeric color choices follow Tailwind v4 default palette so we can compose without a custom theme file.

### view tokens (right sidebar)

```
--journal-stripe        = violet-400 / violet-300
--agenda-now-line       = red-500   / red-400
--agenda-current-hour   = neutral-200 / neutral-800
--todo-priority-a       = red-500
--todo-priority-b       = amber-500
--todo-priority-c       = neutral-400
--todo-deadline-overdue = red-500
--todo-deadline-soon    = amber-500
```

### editor tokens (yank highlight, block highlight, dirty)

```
--yank-flash            = yellow-200 (light) / yellow-700 30% alpha (dark)
--block-jump-highlight  = blue-200             / blue-700 30%
--buffer-dirty-dot      = orange-500
```

The yank-flash and block-jump animations are CSS keyframes, ~250ms ease-out.

### chrome tokens

```
--shell-border          = border (shadcn token)
--sidebar-bg            = card (shadcn token)
--sidebar-active-row    = accent (shadcn token)
--statusbar-bg          = card
--statusbar-fg          = card-foreground
--resize-handle         = border / hover: ring
```

## typography

- **Sans:** Inter (variable). Bundled locally as a static asset under `apps/desktop/src/fonts/`. No Google CDN.
- **Mono:** JetBrains Mono or Berkeley Mono (decide during phase 8). Bundled locally.
- **Editor:** mono. 14px default, configurable via settings (12–18px).
- **UI chrome:** sans. 13px default for sidebars, 12px for status bar, 14px for editor body, 15px for headings in palette / settings.
- **Letter spacing:** tracking-tight on headings, default elsewhere.

## spacing scale

Tailwind defaults. We do NOT customize the spacing scale — drift kills consistency. Components compose from `space-x/y-*`, `gap-*`, `p-*` directly.

## elevation

Two surfaces only:

- **base** — the shell, sidebars, status bar. No shadow.
- **floating** — palette, which-key popup, toasts, settings modal. `shadow-lg` + ring-1 ring-border.

No third layer. Anything that wants to "pop more" is wrong; we're in a desktop app, not a mobile interaction.

## components (shared in `packages/ui`)

We use shadcn primitives where they exist. Where we author custom, the table below names them.

| component | source | purpose |
|-----------|--------|---------|
| `Button`, `Dialog`, `Tabs`, `Tooltip`, `Separator`, `ScrollArea`, `Popover`, `Command` | shadcn / Base UI | standard primitives |
| `Pane` | custom | two-pane shell cell with collapse + resize (editor + right sidebar only — no left sidebar exists) |
| `ResizeHandle` | custom | the bar between panes |
| `ModePill` | custom (consumes `vimStore.mode`) | status bar pill, color-coded |
| `ChordReadout` | custom (consumes `vimStore.chordInProgress`) | text right of the mode pill |
| `WhichKeyPopup` | custom | overlay anchored bottom-center, 300ms after leader |
| `BlockSnippet` | `packages/editor` | re-exported here for views |
| `Tab` | custom | one tab in either tab strip |
| `TabStrip` | custom | row of tabs, drop-target reorder |
| `StatusBar` | custom | bottom row, slots: [ModePill, ChordReadout, vault path, index, …] |
| `EmptyState` | custom | uniform empty card across views |
| `Toast` (sonner) | catalog dep | post-action confirmations |

## the palette UI

The palette IS the app — see `09-command-palette.md`. Layout when preview pane is collapsed:

- Modal centered, max-width 720px, max-height 70vh.
- Top: filter input. Single line. Mode pill inside the input (right-aligned) flips between INSERT (green) and LIST (gray).
- Body: virtualized list of items via TanStack Virtual. Each row 36px tall. Slots: icon (16px Lucide) → label → detail (muted) → hint (kbd, right-aligned).
- Footer: 24px. Shows the current provider hint and global hint chips (`⌘K toggle · Esc close · Tab actions · ⌘⇧\ preview`).
- Selection: full-row background `accent`. Keyboard-driven only — no hover styles fight the cursor.

When preview is open: split horizontally, list on the left (~420px min), preview pane on the right (max 320px, collapsible). Resize handle in the middle. Preview content depends on the result type — file → first 20 lines, block → body + ancestor breadcrumb.

### action sub-list (Tab on a result)

When the user presses `Tab` on a highlighted result, the result row expands inline to show the action sub-list — a small column of action rows, each with: single-letter shortcut (left), label (center), optional detail (right). Esc collapses back. The sub-list scrolls inside the row container; the rest of the result list dims to 50% opacity.

### help card (`?` prefix)

A single result card with the prefix grid (same layout as empty state) plus one-line descriptions for each prefix. Rendered as an item; Enter on it does nothing. Pure documentation surface in the result list.

### block-details popover

Triggered by `Cmd+Shift+I` or `Space i`. Anchored near the cursor (auto above/below based on viewport). Width 360px. Layered above the editor with `shadow-lg` + ring-1 ring-border. Slots:

- Heading path breadcrumb (muted, smaller, top)
- Title (semibold, larger)
- Status row: TODO/DONE pill + priority pill + tag chips
- Schedule row: SCHEDULED + DEADLINE timestamps (relative + absolute)
- Footer row: block ID (mono, copy-on-click) + created timestamp

Read-only in MVP — clicking a tag/priority/etc shows a hint pointing to the equivalent ex command. Dismiss with Esc.

## which-key popup

- Bottom-center, max-width 720px, max-height 320px.
- Shows ONE chord level at a time. If user presses `Space`, popup shows top-level leader bindings; press `f`, popup updates to file-related sub-bindings.
- Each row: kbd cap on the left (e.g., `f`), description right (e.g., "find file"). Grouped headings if the chord level has > 8 entries.
- Animates in/out with `opacity` + 4px translate-y over 120ms.
- Dismisses on chord complete, on `Esc`, or after 5s of total inactivity.

## status bar

24px tall, bottom of viewport.

```
[ModePill][ChordReadout]            [vault: ~/notes]   [Indexed 1,243 · idle]
```

Left-anchored mode block, right-anchored vault + index. Truncate vault path in the middle if too long. Status text is `text-xs` (12px) muted.

## two-pane shell

```
grid-template-columns: 1fr var(--right, 0);
grid-template-rows: 1fr 24px;
```

There is no left sidebar. Right width persisted to `app_state`. One resize handle between editor and right sidebar: 6px hit area, 1px visible border. Hover: thicker ring. Active drag: thicker still, cursor `col-resize`. Double-click → toggle right sidebar collapsed / expanded.

## tabs

| state | look |
|-------|------|
| active | underline 2px in `--mode-normal`; full opacity |
| inactive | no underline; opacity 70% |
| hover | opacity 90%; close-x reveals |
| dirty | small dot to the right of label, `--buffer-dirty-dot` |
| right-click | context menu with palette commands |

## sidebar tabs (right only)

The same `Tab` component, smaller. Right sidebar holds N tabs (one per open view: Journal, Agenda, Todos). No left sidebar exists.

## empty states

Consistent card across views:

```
[icon, 32px, opacity 50%]

[heading, 16px, semibold]

[body, 14px, muted]

[primary CTA — opens palette pre-populated]
```

Examples:
- Journal empty → "Capture your first journal entry" + CTA "⌘K → `j hello`"
- Todos empty → "No TODOs yet" + CTA "⌘K → `t buy milk`"
- Editor with no buffer open → "Open a file with `Space f` or `Cmd+K → f`"

## icons

Lucide. We use a small subset to keep the brand tight. Rough allocation:

| component | icon |
|-----------|------|
| journal view tab | `book-open` |
| agenda view tab | `calendar` |
| todos view tab | `list-checks` |
| outline (palette `o ` mode) | `align-left` |
| block-details popover trigger | `info` |
| palette command | `chevron-right` |
| capture | `plus-circle` |
| file | `file-text` |
| block | `hash` |
| view | `layout` |
| settings | `settings-2` |
| vault | `folder` |
| sidebar toggle | `panel-left` / `panel-right` |
| dirty | (custom dot, not a Lucide icon) |

## animation principles

- Modal in/out: 120ms ease-out.
- Yank flash: 250ms ease-out.
- Block-jump highlight: 1s decay.
- Sidebar resize: no animation (instant feedback).
- Sidebar collapse/expand: 200ms ease-in-out.
- Tab close: 80ms fade.
- Mode pill transition: instant background swap, no animation.

We do NOT animate keyboard-driven actions (selection moves, palette result changes, list-mode `j/k`). Animation here is friction.

## dark mode

Same tokens, dark variants. The user's OS appearance is honored via Tauri's `theme()` API. Manual override via palette command `Toggle theme`. Tokens are defined in `:root` (light) and `[data-theme=dark]` (dark) blocks in `packages/ui/src/styles/globals.css`.

## keyboard hints in the UI

Wherever we show a kbd hint (palette footer, tooltip, settings), use a small `<kbd>` component with shadcn-style styling: 1px ring, rounded-sm, mono font, 11px, faded foreground. Multi-key chords use spaces (`Space f b`), modifiers use the OS-appropriate symbol (`⌘ K` on macOS, `Ctrl K` on Windows/Linux).

## what is NOT in this doc

- Component implementations.
- A Figma file. We're pre-implementation; once the shell lands we revisit.
- Marketing-page design (deferred, lives in `apps/web` issue W1).
- Mobile design tokens (deferred, M1).
- Print stylesheet.

## known unknowns

- **Berkeley Mono is paid; JetBrains Mono is free.** Decide in phase 8 polish. Likely JetBrains Mono for the public release, optional Berkeley/Iosevka swap via the editor settings.
- **Inter at 13px is dense on lower-DPI external monitors.** Validate on a 1440p monitor before committing the size; bump to 14px if cramped.
- **shadcn `base-lyra` style vs custom theme.** `base-lyra` already ships in BTS — we accept it. If we end up wanting a less neutral feel we revisit, but not before phase 8.

## what we are NOT building (for clarity)

- Custom-painted scrollbars beyond minimal Tailwind defaults.
- An animation library (Framer Motion). CSS keyframes are enough for our motion needs.
- Custom emoji rendering. We don't render emoji at all in the UI chrome — only inside user content.
