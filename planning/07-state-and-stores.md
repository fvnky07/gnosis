# 07 — state and stores

## why Zustand and not TanStack Query

The user instruction locks in Zustand. We don't add TanStack Query in MVP. Reasons that align with the constraint:

- Server-shape data is local SQLite, microsecond reads. We don't need request dedup, retries, background refetch.
- One library to learn, debug, and Devtool.
- Invalidation is a function call, not a query-key dance.

We use **selective subscriptions** to keep render counts honest. Components subscribe via selector slices.

## stores (each is its own file in `apps/desktop/src/stores/`)

### `vaultStore`
- `rootPath: string | null`
- `isReady: boolean`
- `indexProgress: { phase, filesParsed, idsMinted } | null`
- actions: `pickVault`, `openVault(path)`, `refreshIndex`

Owns the vault root and the indexer's progress. Read-only outside this store except for actions.

### `bufferStore`
- `buffers: Record<bufferId, BufferState>`
- `activeBufferId: string | null`
- `tabOrder: string[]`
- actions: `openBuffer({ path, blockId? })`, `closeBuffer(id)`, `focusBuffer(id)`, `markDirty(id)`, `commitWrite(id)`

A "buffer" is an open file in the editor. Tabs are `tabOrder`. Closing the active tab focuses the previous in `tabOrder`. We persist `tabOrder` and `activeBufferId` to `app_state` on every change (debounced 1s) so the next launch restores layout.

### `paletteStore`
- `isOpen: boolean`
- `mode: 'root' | 'capture' | 'fileSearch' | 'blockSearch' | 'view' | 'commands'`
- `query: string`
- `pendingTemplate: TemplateId | null`
- `history: { commandId, ts }[]`
- actions: `open(modeOrNull?)`, `close`, `setQuery`, `chooseProvider(id)`, `submit`

The palette state machine is small but tricky. See `09-command-palette.md`.

### `viewStore`
- `rightTabs: ViewTab[]`         // active views in the right sidebar
- `activeRightTabId: string | null`
- actions: `openView(kind)`, `closeView(id)`, `focusView(id)`, `reorderTabs`

`ViewTab.kind` ∈ `'journal' | 'agenda' | 'todos'`. Multiple of the same kind permitted (an agenda for "this week" plus another for "month") — though the MVP UI only opens one of each.

### `selectionStore` (replaces former `outlineStore`)
- `selectedBlockId: string | null`            // current block under cursor in active buffer
- `headingsForBufferId: string | null`        // cached for the `o ` palette mode
- `headings: BlockHeadingRow[]`               // depth, title, range; refreshed on buffer change or edit
- `blockDetailsPopover: { open: boolean, anchor: { line, ch } | null }`

The left sidebar is gone. This store still tracks "what block is the user looking at" so two consumers can read it: the `o ` palette outline mode (consumes `headings`) and the block-details popover (`Cmd+Shift+I` / `Space i`, consumes `selectedBlockId` to hydrate metadata from the DB on open).

### `settingsStore`
- `theme: 'light' | 'dark' | 'system'`
- `vimEnabled: boolean`           // default false
- `globalShortcut: string`        // default `CmdOrCtrl+Shift+K`
- `dailyNotePath: string`         // default `daily/`
- actions: persist via `app_state.settings` JSON

### `vimStore`
Mirrors the editor's vim mode out so non-editor surfaces (status bar mode pill, list-mode handler, focus stack) can react to it.
- `mode: 'NORMAL' | 'INSERT' | 'VISUAL' | 'VISUAL-LINE' | 'VISUAL-BLOCK' | 'COMMAND' | 'REPLACE' | 'LIST' | 'LEADER'`
- `chordInProgress: string | null`        // e.g. `'g'`, `'Space f'` — drives the chord readout in the status bar
- `whichKeyVisible: boolean`               // popup shown after 300ms of leader inactivity
- `focusStack: FocusLayer[]`               // ordered layers (editor, sidebar, modal, filter); Esc pops the top
- `enabled: boolean`                       // settings toggle; default true
- actions: `setMode`, `pushFocus`, `popFocus`, `setChord`, `clearChord`, `toggleEnabled`

Owned by `apps/desktop`; subscribed to by `<ModePill />`, `<WhichKeyPopup />`, the global `tinykeys` handler, and the editor's `vim-mode-change` bridge. Full behavior in `15-vim-mode.md`.

### `indexEventBus` (not a store, a tiny emitter)
- Emits `'block.upserted'`, `'block.deleted'`, `'file.indexed'` with affected ids/paths.
- Views subscribe and re-query.

## ownership rules

- The editor owns buffer text. `bufferStore` carries the `text` only when the editor is unmounted; while mounted, CodeMirror is the truth and we mirror dirty state out.
- The indexer is the only thing that writes to `blocks` or `files` rows.
- The palette doesn't store its own data; it reads from stores and DB on demand.
- Views never reach into the editor; they emit "open this block" events that the buffer store handles.

## what gets persisted across launches

Persisted to `app_state` (key, value):

- `vault.rootPath`
- `tabs.openBuffers` — paths + scroll positions
- `tabs.activeBufferId`
- `views.rightTabs` — kinds and config
- `settings.*`
- `palette.history` (last 50 entries)

NOT persisted: editor content (lives in files), indexer progress, transient palette query.

## reactive flow for an edit

```
CodeMirror onUpdate
  → bufferStore.markDirty(id)
  → debounced 250ms idle:
      vault.write(path, text)
      indexer.incremental(path)
      indexEventBus.emit('file.indexed', path)
  → views subscribed to that path's tags re-query
  → outlineStore recomputes from new AST
```

## reactive flow for a capture

```
paletteStore.submit (with mode='capture')
  → core.append({ daily: today, body, tags })
  → vault.write
  → indexer.incremental(dailyPath)
  → indexEventBus.emit
  → bufferStore: if today's daily is open, refresh its text from disk; else no-op
  → palette closes
```

## known unknowns

- **Whether to keep CodeMirror state in `bufferStore`.** Probably no — we hand the editor a `Text` object and let it own state until unmount, persisting only path + scroll. Settle in editor work, doc 08.
- **Cross-store dependencies.** `bufferStore` reading `vaultStore.rootPath` is fine. We do not nest stores or use slices-of-slices. Keep it flat. If a store grows past 200 lines, split it.

## what's NOT here

- No global "isLoading" state. Loading is local to whatever is loading.
- No undo stack at the app level. Editor undo is CodeMirror's. File-level undo is the user's git/backup.
- No optimistic UI for capture. The action is fast enough that we render after success, not before.
