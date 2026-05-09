# 17 — keymap reference

## why this doc

Single sheet of every key and chord in MVP gnosis. Useful for users (we ship this in `:help` / settings), useful for tests (one place to check coverage), useful for spec drift (any new binding must land here too).

Bindings are grouped by surface. Surfaces are: **editor (cm-vim)**, **global (any focus)**, **palette**, **list mode (sidebars + views)**.

Every binding has a corresponding palette command id (the discipline from `09-command-palette.md`). The palette command id is the canonical handle; key bindings are aliases.

## conventions

- `Space` is the leader.
- `Cmd` is `Cmd` on macOS, `Ctrl` on Windows/Linux. Bindings written as `Cmd+...`.
- `Ctrl` always means physical Ctrl (no remap on macOS).
- Multi-key chords are written space-separated (`Space f b`).
- A trailing `…` means the action opens a sub-prompt or modal.
- Bindings flagged **(deferred)** are in `gnosis.vimrc` v0.2 territory (issue VIM-1).

---

## global (active when no editor / input has focus, or as overrides at the document level)

| key / chord | command id | action |
|-------------|------------|--------|
| `Cmd+K` | `palette.openRoot` | Open palette in root mode |
| `Cmd+Shift+K` | `palette.openCapture` | Open palette in capture mode |
| `Space Space` | `palette.openRoot` | Same as Cmd+K (vim path) |
| `Cmd+B` | `palette.openBlockSearch` | Open palette in `b ` block-search mode (former left-sidebar toggle is gone — no left sidebar) |
| `Cmd+Shift+B` | `shell.toggleRightSidebar` | Toggle right sidebar |
| `Space tr` | `shell.toggleRightSidebar` | Same |
| `Cmd+P` | `palette.openFileSearch` | Open palette in `f ` file-search mode |
| `Cmd+Shift+O` | `palette.openOutline` | Open palette in `o ` outline mode (active buffer headings) |
| `Cmd+Shift+I` | `block.showDetailsPopover` | Inline block-details popover at cursor |
| `Space i` | `block.showDetailsPopover` | Same (vim) |
| `Ctrl+Tab` | `tabs.mruOverlay` | Hold-and-release MRU buffer overlay (separate component) |
| `Cmd+Shift+\` | `palette.togglePreviewPane` | Toggle palette preview pane (only meaningful when palette is open) |
| `Cmd+Shift+T` | `tabs.reopenLastClosed` | Reopen last closed buffer |
| `Space u` | `tabs.reopenLastClosed` | Same |
| `Cmd+1` … `Cmd+9` | `tabs.focusN` | Focus buffer N |
| `1gt` … `9gt` | `tabs.focusN` | Same (vim) |
| `gt` | `tabs.next` | Focus next buffer tab |
| `gT` | `tabs.prev` | Focus previous buffer tab |
| `Cmd+W` | `tabs.closeActive` | Close active buffer (close window if last) |
| `:q` | `tabs.closeActive` | Same |
| `Cmd+,` | `settings.open` | Open settings |
| `Space ,` | `settings.open` | Same |
| `Cmd+Shift+P` | `palette.openCommands` | Open palette in commands mode |
| `Esc` | `focus.popStack` | Pop focus stack (close palette / blur sidebar / exit visual / clear search highlight) |
| `Ctrl+W l` | `shell.focusRightSidebar` | Focus right sidebar |
| `Ctrl+W h` | `shell.focusEditor` | Focus editor (back from right sidebar) |
| `Ctrl+W o` | `shell.focusEditorOnly` | Collapse right sidebar, focus editor |
| (configurable) | `app.bringToFront` | Tauri global hotkey, default `Cmd+Shift+G` |

## leader chords

`Space` opens the leader. After 300ms of inactivity the which-key popup appears. Common chords:

| chord | command id | action |
|-------|------------|--------|
| `Space Space` | `palette.openRoot` | Open palette |
| `Space f` | `palette.openFileSearch` | File search |
| `Space b` | `palette.openBlockSearch` | Block search |
| `Space j` | `capture.journal` | Inline journal capture (palette opens with `j ` prefilled) |
| `Space t` | `capture.task` | Inline task capture |
| `Space n` | `capture.note` | Inline note capture |
| `Space v j` | `view.openJournal` | Open journal view tab |
| `Space v a` | `view.openAgenda` | Open agenda view tab |
| `Space v t` | `view.openTodos` | Open todos view tab |
| `Space c` | `palette.openCapture` | Capture menu |
| `Space r` | `index.refresh` | Manual reindex |
| `Space tr` | sidebar toggle | (above) |
| `Space o` | `palette.openOutline` | Outline of active buffer |
| `Space i` | `block.showDetailsPopover` | Block details popover |
| `Space u` | `tabs.reopenLastClosed` | (above) |
| `Space ,` | `settings.open` | (above) |
| `Space ?` | `help.openKeymap` | Show this reference |
| `Space h t` | `theme.toggle` | Toggle theme |
| `Space h v` | `vault.switch` | Switch vault… |
| `Space q` | `app.quit` | Quit (asks confirm) |

## editor (cm-vim) — additions on top of standard vim

Standard vim bindings (`hjkl`, `wbeWBE`, `iaIAVvR`, `dycp...`, `f F t T`, `gg G`, `0 ^ $ %`, `r R`, `o O`, marks, registers, macros, search) work as in vim. The table below covers gnosis-specific additions and overrides.

### normal-mode motions (org-aware)

| key | command id | action |
|-----|------------|--------|
| `]]` | `editor.nextHeading` | Next heading at any depth |
| `[[` | `editor.prevHeading` | Previous heading at any depth |
| `]h` | `editor.nextSiblingHeading` | Next heading at same depth |
| `[h` | `editor.prevSiblingHeading` | Previous heading at same depth |
| `]c` | `editor.nextTodoBlock` | Next TODO block |
| `[c` | `editor.prevTodoBlock` | Previous TODO block |
| `]p` | `editor.nextDeadlineSoon` | Next block with deadline within lead time |
| `[p` | `editor.prevDeadlineSoon` | Previous |

### text objects (org-aware)

| key | command id | action |
|-----|------------|--------|
| `ih` / `ah` | `editor.headingTextObject` | Inner / a heading body |
| `id` / `ad` | `editor.drawerTextObject` | Inner / a properties drawer |
| `it` / `at` | `editor.tagsTextObject` | Inner / a tag region on heading line |

### fold operators

| key | command id | action |
|-----|------------|--------|
| `zc` | `editor.foldClose` | Close fold under cursor |
| `zo` | `editor.foldOpen` | Open fold under cursor |
| `za` | `editor.foldToggle` | Toggle fold |
| `zM` | `editor.foldAll` | Fold all |
| `zR` | `editor.foldNone` | Unfold all |

### ex commands (every palette command is mirrored — selection)

| ex | shorthand | command id |
|----|-----------|------------|
| `:capture` | `:cap` | `palette.openCapture` |
| `:journal {text}` | `:j` | `capture.journalInline` |
| `:task {text}` | `:t` | `capture.taskInline` |
| `:done` | `:do` | `block.markDone` |
| `:todo` | `:to` | `block.markTodo` |
| `:schedule {date}` | `:sch` | `block.setSchedule` |
| `:deadline {date}` | `:dl` | `block.setDeadline` |
| `:tag {name}` | `:ta` | `block.addTag` |
| `:untag {name}` | — | `block.removeTag` |
| `:priority {A\|B\|C\|none}` | `:pri` | `block.setPriority` |
| `:extract` | `:ex` | `block.extractSubtree` |
| `:open {path}` | `:o` | `tabs.openByPath` |
| `:search {q}` | `:s` (excluding `:%s/.../`) | `palette.openBlockSearch` |
| `:view {kind}` | `:v` | `view.open` |
| `:vault` | — | `vault.switch` |
| `:settings` | `:set` (partial; real `:set foo=bar` still works) | `settings.open` |
| `:reindex` | — | `index.refresh` |
| `:nohl` | — | `editor.clearSearchHighlight` |
| `:help` | — | `help.openKeymap` |
| `:q` | — | `tabs.closeActive` |
| `:wq`, `:x` | — | aliases for `:q` |

### insert mode

Standard vim insert. No custom bindings in MVP. `Esc` exits to normal. **(deferred)** snippet expansion, autocomplete trigger keys.

### visual mode

Standard vim visual. `o` swaps caret/anchor. `:` enters command-line for the visual range (passes range to ex commands as `'<,'>`).

## palette — INSERT mode (cursor in filter)

| key | action |
|-----|--------|
| typing | filter |
| `Up` / `Down` | move selection |
| `Enter` | submit |
| `Tab` | cycle provider in root mode |
| `Esc` | switch to LIST mode |
| `Cmd+Backspace` | clear filter |

## palette — LIST mode (after first `Esc`)

| key | action |
|-----|--------|
| `j` / `k` | move selection |
| `gg` / `G` | jump to first / last result |
| `Ctrl-d` / `Ctrl-u` | half page |
| `Enter` or `o` | submit |
| `i` or `/` | return to INSERT mode |
| `Esc` | close palette (pop focus stack) |

## list mode (sidebars + views)

Triggered by `Ctrl+W h/l` to focus a sidebar, or by clicking a view card with `Esc` afterward.

| key | action |
|-----|--------|
| `j` / `k` | move item cursor |
| `gg` / `G` | jump to first / last item |
| `Ctrl-d` / `Ctrl-u` | half page |
| `/` | enter inline filter (pseudo-INSERT) |
| `Enter` or `o` | open selected (Enter = current pane, `o` = new tab) |
| `x` | mark TODO ↔ DONE on focused block (todos / agenda) |
| `dd` | archive / delete focused row (with undo) |
| `v` | visual multi-select |
| `Tab` / `Shift-Tab` | move between sibling tabs |
| `q` | close focused panel |
| `Space …` | leader chord (same as global) |
| `Esc` | exit filter to nav, or pop focus stack |

## settings — keybindings tab

This doc is also the source of truth for the settings UI's keybindings tab. We render the same tables there with a "press to record" affordance for each row in v0.2 (issue VIM-1).

## conflict policy

When two bindings share a key:

1. **Editor focus + cm-vim mode** wins for keys cm-vim claims (e.g., `j` in normal). Global handler does not fire.
2. **Modal open** (palette, settings, vault picker) wins for keys it claims. Esc is always handled by the global focus stack handler at capture phase.
3. **Filter input focus** in a list view: typing keys go to the filter; navigation keys (`Esc`, `Up`, `Down`) go to the list-mode handler.
4. **Tauri global hotkey** wins regardless of focus (it's OS-level).

When keys are ambiguous between user expectation and our binding, the palette wins. Example: `j` could mean "move down in list" OR "open journal via leader" — `j` alone is move, `Space j` is the journal capture. The leader-prefixed form removes ambiguity.

## things we don't bind

- `Cmd+R` — reload, intercepted and ignored by `tauri-plugin-prevent-default`.
- `Cmd+F` — browser find, intercepted; gnosis uses `/` and palette block search.
- `Cmd+Q` — quits the app via OS. Not intercepted.
- `Cmd+L` — N/A in webview (no address bar).
- `F11` / `Cmd+Ctrl+F` — fullscreen, OS-handled.

## test coverage hook

`packages/editor/test/keymap.test.ts` reads this doc, parses tables, and asserts that each command id is registered AND each key sequence routes to it. Drift detection — if a row leaves the table without the test changing, the test fails. (Implementation deferred to phase 5; documented here so tests have a target.)

## known unknowns

- **`Ctrl+W` collisions in some terminals/shells.** N/A inside the Tauri webview. Documented for future reference if we ever ship a CLI variant.
- **macOS `Option`-key dead-key conflicts** with composed characters. Editor wraps with composition listeners (see `15-vim-mode.md`).
- **Custom shortcuts in v0.2.** `gnosis.vimrc` will override anything in this doc; the table here is the *default* reference. Issue VIM-1.
