# 08 — editor

## what we're building

A CodeMirror 6 instance that edits whole `.org` files. It is the only place where bytes flow from UI to disk. It does NOT handle parsing — it sees plain text, debounces writes, and lets the indexer re-parse on disk.

It lives in `packages/editor` and is consumed by `apps/desktop`.

## extensions we ship in MVP

- `@codemirror/state`, `@codemirror/view`, `@codemirror/commands` (core)
- `@codemirror/language`
- `@codemirror/lang-markdown` — **placeholder** for org syntax highlighting (see "deferred")
- `@codemirror/search` — built-in find/replace
- `@replit/codemirror-vim` — **on by default**, statically imported, plus the gnosis ex/motion/text-object layer in `15-vim-mode.md`
- `@codemirror/autocomplete` — for `:tag:` and TODO keyword completion (very small completion source)
- A custom `gnosis-org-extras` extension we author: highlights `* TODO`, `[#A]`, `:tags:`, and `<DATE>` with simple pattern decorations. Not a real grammar — regex-driven decorations on top of markdown highlighting. This is a half-day's work and gives 80% of the visual benefit.
- A custom `gnosis-yank-highlight` extension: brief tint on the yanked range when `y{motion}` completes.

## what we explicitly defer (issue E1, E2)

- A proper Lezer grammar for org-mode.
- Inline preview rendering (live blocks, hide markup on focused lines).
- Image inlining.
- Code-block syntax highlighting per language.
- Mouse-driven block folding UI (we keep keyboard `tab`/`shift-tab` org-style cycling for v0.2).

## buffer model

The editor takes a `BufferProps`:

```
{
  bufferId: string
  initialDoc: string          // full file contents
  filePath: string
  vimEnabled: boolean
  onChange: (text: string) => void   // debounced 250 ms idle
  onScroll: (top: number) => void    // debounced 1 s
  initialSelection?: Range
}
```

CodeMirror's `EditorState` is the source of truth while mounted. On unmount, we serialize text + scroll back to `bufferStore`.

## file-write debounce

CodeMirror update → flag `dirty` → after 250 ms idle → `vault.write` → `indexer.incremental` → views re-query.

If the user types continuously, no write happens. If they pause, write fires within 250 ms. This means a crash in mid-keystroke can lose up to ~250 ms of typing, which is acceptable for MVP and matches what most editors do. Future issue: fsync more aggressively on focus loss.

## block-aware editing

The editor doesn't render blocks specially in MVP. But we do enable three block-oriented behaviors:

1. **Jump-to-block.** `bufferStore.openBuffer({ blockId })` resolves the block's `rangeInFile` and dispatches `EditorView.scrollIntoView(...)` plus a one-second highlight decoration on those lines.
2. **Block extraction (palette command).** "Extract subtree to new file" reads the block's range from the parser, writes a new file, replaces the range in the source with a `[[file:newfile.org][title]]` link.
3. **Block details popover.** `Cmd+Shift+I` (or `Space i` in vim NORMAL) opens an inline popover anchored near the cursor showing the current block's metadata (id, heading path, tags, TODO state, priority, scheduled, deadline, created). Read-only in MVP. Replaces the former left-sidebar block-details panel — the left sidebar is gone (see `11-layout-and-shell.md`). Implementation: a `<BlockDetailsPopover />` component in `apps/desktop` reads `selectionStore.selectedBlockId` and queries the DB on open.

Outline of the active buffer is no longer a sidebar; it's a palette mode (`o ` prefix in the palette opens it) plus editor folding (`zc/zo/za/zM/zR`). See `09-command-palette.md`.

## vim mode

**On by default.** This is core, not a setting. `@replit/codemirror-vim` v6.3.0 is imported statically and registered as part of the standard editor extension stack. Disabling vim still works (a recreate-view path keyed off `settingsStore.vimEnabled === false`) but the product is designed around vim being on.

A long custom layer ships on top of cm-vim — ex commands that mirror palette actions (`:capture`, `:done`, `:schedule`, `:tag`, …), org-aware text objects (`ih`/`ah` for headings, `id`/`ad` for the properties drawer), org-aware motions (`]]`/`[[` for headings, `]c`/`[c` for TODO blocks), native fold operators (`zc`/`zo`/`za`/`zM`/`zR`), and a baked-in vimrc-equivalent (`clipboard=unnamed`, `gt`/`gT`, `ignorecase`/`smartcase`, leader = Space).

Persistence: marks (single-file `'a`–`'z` and global `'A`–`'Z`), search history, and named registers (`"a`–`"z`) survive restart via `app_state` rows. Anonymous and numbered registers are session-scoped per vim convention.

Full plan, including the global handler that gives lists and panels modal navigation, lives in `15-vim-mode.md`.

## keyboard shortcuts handled by the editor

| Combo | Action |
|-------|--------|
| Cmd+S | Force flush pending write (no-op if nothing pending) |
| Cmd+Z / Cmd+Shift+Z | Undo / redo (CodeMirror native) |
| Cmd+F | Open in-editor find |
| Tab / Shift-Tab | Indent / outdent |
| Cmd+/ | Toggle comment (`# ` for org) |

Cmd+K is **not** handled by the editor — it's a global capture for the palette (see `09-command-palette.md`).

## scrolling and persistence

Scroll position is persisted per buffer to `app_state` so re-opening a file resumes the line. Scroll persistence runs at 1 s debounce.

## the placeholder syntax highlighting

Until org grammar lands (issue E1), we use `markdown()` from `@codemirror/lang-markdown` to give the editor *some* highlighting (headings render bigger, lists, links). On top of that we layer regex decorations for org-specific tokens:

- `^\*+ (TODO|DONE)` → keyword class
- `\[#[ABC]\]` → priority class
- `:[A-Za-z0-9_@#%]+:(?=\s|$)` → tag class on heading lines only
- `<\d{4}-\d{2}-\d{2}.*?>` and `\[\d{4}-\d{2}-\d{2}.*?\]` → timestamp class
- `^:PROPERTIES:` / `^:END:` → drawer marker class
- `^#\+\w+:` → keyword class

This is incorrect for edge cases (org and markdown disagree on emphasis, lists, and link syntax), but it is good enough for MVP and we surface this trade explicitly in the readme of `packages/editor`.

## render mode for blocks (right sidebar previews)

Views render block snippets as plain text with the same regex highlighters but without an editor. We export a `BlockSnippet` component from `packages/editor` that runs the highlight pass over a string and returns React nodes. View files use it to make block previews look consistent with the editor.

## known unknowns

- **Static import for cm-vim.** Vim is on by default, so dynamic-import buys us nothing — every editor instance loads it on first frame. Static import keeps things simple. Bundle weight (~60–80 KB gzipped) is acceptable.
- **Cmd+S preventDefault in Tauri webview.** Tauri's webview may try to invoke the OS save dialog on Cmd+S. We capture the keydown at the document level and `preventDefault`.

## interface from `packages/editor`

```
<EditorPane bufferId={...} />     // bound to bufferStore
<BlockSnippet text={...} />       // pure render of org-flavored highlighted text
```

That is the public surface. Internals are not exposed.

## what we are NOT doing in MVP

- No multi-cursor beyond CodeMirror's defaults.
- No collaborative editing.
- No remote-image preview.
- No org-babel src block execution.
- No headline cycling animation.
