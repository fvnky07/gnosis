# gnosis

> A local-first, file-based, org-mode-compatible note app driven by a command palette.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/Status-pre--alpha-red.svg)](./planning/14-roadmap-and-deferred.md)

`gnosis` is a desktop note app where a folder of `.org` files is the database, the command palette is the only interface that matters, and views are saved queries over your tagged blocks.

- **Local-first.** No server, no sync, no account. The user picks a folder; that folder is the vault.
- **File-based.** `.org` files are the source of truth. SQLite is a derived index — deleting it is safe.
- **Block-oriented.** Every heading is a block. Blocks carry tags, scheduling, todo state, priority, properties.
- **Palette-driven.** Cmd+K (and `Space Space` in normal mode) is the app. Capture, search, navigation, view-opening, command execution all flow through one modal.
- **Vim-first.** Vim is the default interaction mode — pervasive across editor, palette, sidebars, tabs, and views.
- **Org-compatible.** Open the vault in Emacs, edit anything, gnosis re-indexes on next launch without data loss.

See [`planning/01-overview-and-mvp.md`](./planning/01-overview-and-mvp.md) for the product spec, [`planning/02-architecture.md`](./planning/02-architecture.md) for the system architecture, and [`planning/14-roadmap-and-deferred.md`](./planning/14-roadmap-and-deferred.md) for phase-by-phase progress.

## Status

Pre-alpha. Foundation phases complete (scaffold restructure, Tauri plumbing, SQLite bootstrap). The editor, parser, palette, and views are not yet built. See the roadmap for what's shipped and what's next.

## Stack

- **TypeScript** end-to-end
- **Tauri 2** desktop shell (Rust crate hosts native plugins)
- **Vite + React** for the desktop UI
- **Drizzle ORM** + **SQLite** (via `tauri-plugin-sql`) for the derived index
- **Bun** workspaces + **Turborepo** for the monorepo
- **Biome** for lint and format
- **CodeMirror 6** + **`@replit/codemirror-vim`** for the editor (planned, not yet wired)

## Getting Started

```bash
bun install
bun run tauri:dev   # native window with sqlite + dialog wired (slow first compile: 5–10 min)
```

Or, for the Vite shell only (no Tauri APIs, useful for UI iteration):

```bash
bun run dev:desktop
```

## Project Structure

```
gnosis/
├── apps/
│   ├── desktop/     # Tauri desktop app (Vite + React) — the MVP
│   ├── web/         # Marketing landing page (Next.js, deferred)
│   ├── docs/        # Documentation site (Fumadocs, port 4000)
│   └── mobile/      # React Native / Expo (scaffold only, deferred)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── core/        # Org parser + AST + vault adapter (planned)
│   ├── editor/      # CodeMirror + vim integration (planned)
│   ├── views/       # Journal, agenda, todos render (planned)
│   ├── db/          # Drizzle schema + typed query builders
│   ├── config/      # Shared tsconfig.base.json
│   └── env/         # Shared zod-validated env
└── planning/        # Implementation plan (17 docs, ~90 min readthrough)
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run check-types`: TypeScript type-check across all workspaces
- `bun run test`: Run tests across packages
- `bun run dev:desktop`: Start the Vite shell for the desktop app
- `bun run dev:web`: Start the Next.js landing page
- `bun run dev:docs`: Start the Fumadocs site
- `bun run dev:mobile`: Start the React Native / Expo dev server
- `bun run tauri:dev`: Run the Tauri desktop app in dev mode
- `bun run tauri:build`: Build the Tauri desktop app
- `bun run check`: Run Biome formatting and linting

## UI Customization

React surfaces share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases in `packages/ui/components.json` and the per-app `components.json`

To add more shared primitives:

```bash
bunx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

## Contributing

The implementation plan in `planning/` is the canonical roadmap. Pick a phase or a deferred-issue tracker (V*/P*/E*/Q*/U*/B*/T*/W*/M*/X*/S* prefixes in `planning/14-roadmap-and-deferred.md`), open an issue, and submit a PR against the `dev` branch.

Before opening a PR:

```bash
bun run check-types
bun run check
bun run test
bun run build
```

## License

MIT. See [`LICENSE`](./LICENSE).
