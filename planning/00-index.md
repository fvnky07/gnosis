# gnosis — implementation plan index

This directory holds the full plan to take the Better-T-Stack scaffold to a working MVP of `gnosis`: a local-first, file-based, org-mode-compatible note app driven by a command palette.

The plan is meant to be reviewable in roughly 90 minutes. No application code lives here — only design, scope, sequencing, and known unknowns. Each document is self-contained but expects the reader to have skimmed `01-overview-and-mvp.md` first.

## reading order

| #  | Document | Purpose |
|----|----------|---------|
| 01 | [overview and mvp](01-overview-and-mvp.md) | Product, scope, non-goals, MVP definition |
| 02 | [architecture](02-architecture.md) | Layers, data flow, runtime topology |
| 03 | [monorepo and scaffold delta](03-monorepo-and-scaffold-delta.md) | BTS output → target structure |
| 04 | [vault and indexer](04-vault-and-indexer.md) | Filesystem source of truth, indexing pipeline |
| 05 | [org parser](05-org-parser.md) | Parser scope, AST, round-trip, ULID side effect |
| 06 | [database schema](06-database-schema.md) | SQLite schema, query patterns, Drizzle vs plugin |
| 07 | [state and stores](07-state-and-stores.md) | Zustand stores, ownership boundaries |
| 08 | [editor](08-editor.md) | CodeMirror 6, vim, block edit modes |
| 09 | [command palette](09-command-palette.md) | Palette providers, command registry, UX |
| 10 | [views](10-views.md) | Journal, agenda, todos rendering |
| 11 | [layout and shell](11-layout-and-shell.md) | Two-pane shell (editor + right sidebar), tabs, status bar, focus stack |
| 12 | [tauri and platform](12-tauri-and-platform.md) | Plugins, capabilities, IPC, packaging |
| 13 | [build, test, tooling](13-build-test-tooling.md) | Biome, Vitest, Husky, CI |
| 14 | [roadmap and deferred](14-roadmap-and-deferred.md) | Phases, milestones, deferred-to-issues backlog |
| 15 | [vim mode (core, default-on)](15-vim-mode.md) | Library choice, ex bridge, list mode, focus stack, persistence |
| 16 | [design system](16-design-system.md) | Tokens, components, palette UI, popover, two-pane grid |
| 17 | [keymap reference](17-keymap-reference.md) | Single source of truth for keybinds, vim chords, ex commands |

## conventions

- "MVP" means everything required to satisfy the user-flow defined in `01-overview-and-mvp.md`. Anything else is deferred and listed in `14-roadmap-and-deferred.md`.
- "Spike" means a 30–90 minute throwaway investigation to retire an unknown before committing the path.
- "Defer" means it ships as a GitHub issue rather than as MVP code.
- File paths are always relative to repo root.
- Time estimates assume one engineer with the stack already in their hands; multiply by ~1.6× for first-time-with-Tauri ramp.
