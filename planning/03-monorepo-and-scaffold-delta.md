# 03 — monorepo and scaffold delta

## what BTS gave us

Reading the actual repo at HEAD:

```
gnosis/
├── apps/
│   ├── web/                 # Next.js 16 + Tauri 2 attached, port 3001
│   │   └── src-tauri/       # Cargo, capabilities, conf, icons
│   ├── native/              # Expo / React Native
│   └── fumadocs/            # Fumadocs Next.js, port 4000
├── packages/
│   ├── ui/                  # shadcn primitives via @base-ui/react
│   ├── config/              # tsconfig.base.json
│   └── env/                 # zod-validated env
├── biome.json, turbo.json, package.json, bts.jsonc
└── .husky/, bun.lock
```

Key facts:

- **`apps/web` has Tauri attached.** `src-tauri/` is inside it. `next.config.ts` has `typedRoutes: true, reactCompiler: true` but **no `output: 'export'`** yet. Tauri config points `frontendDist` at `../out` (Next.js export default) and `devUrl` at `:3001`. We are NOT going to make Next.js work as a static export — we are moving `src-tauri/` to a fresh Vite app at `apps/desktop` and changing the frontendDist + devUrl accordingly.
- **`apps/web` is also where the marketing landing would naturally live.** Per the user instruction we are splitting these. `apps/web` keeps Next.js (landing); `apps/desktop` is Vite + React (the MVP app).
- **`apps/native` is Expo + expo-router.** The user wants this renamed to `apps/mobile` and deferred.
- **`apps/fumadocs` runs on port 4000.** The user wants this renamed to `apps/docs` (Fumadocs stays).
- **`packages/ui`** uses shadcn `style: base-lyra` and Base UI primitives. Reused by `apps/web` already. We will reuse it in `apps/desktop` too.
- **No `core`, `editor`, `views`, `db` packages exist yet.** We add them.
- **Tauri plugins installed:** `tauri-plugin-log` only. We need `fs`, `sql`, `dialog`, `global-shortcut`. Added in `12-tauri-and-platform.md`.
- **Capabilities:** only `default.json` exists. We will write per-plugin capability files.
- **Catalog:** `dotenv`, `zod`, `lucide-react`, `next-themes`, `sonner`, `tailwindcss`, `@types/react-dom` are already catalog-pinned. New deps for editor/parser will be added directly to package.jsons.

## target after restructure

```
gnosis/
├── apps/
│   ├── web/         # landing only — no Tauri, no editor (DEFERRED, keep for marketing)
│   ├── desktop/     # Vite + React + Tauri (THE MVP)
│   ├── mobile/      # renamed from native, deferred
│   └── docs/        # renamed from fumadocs
├── packages/
│   ├── ui/          # unchanged, used by web + desktop
│   ├── core/        # NEW — parser, AST, vault ops
│   ├── editor/      # NEW — CodeMirror setup + vim
│   ├── views/       # NEW — journal/agenda/todos render
│   ├── db/          # NEW — Drizzle schema + queries
│   ├── config/      # unchanged
│   └── env/         # unchanged
├── turbo.json
├── package.json
└── bts.jsonc        # leave for BTS tooling; do not edit
```

## restructure plan, ordered

This happens before any feature work. Total: ~half a day.

1. **Move `apps/web/src-tauri/` → `apps/desktop/src-tauri/`.** Pure `git mv`. The Tauri Rust crate stays the same; only its host app changes.
2. **Create `apps/desktop` as a fresh Vite + React + TS app.** Do NOT copy `apps/web` (Next.js). Scaffold via `bun create vite apps/desktop --template react-ts` then trim to the minimal shell. Wire it to `@gnosis/ui`, `@gnosis/core`, `@gnosis/editor`, `@gnosis/views`, `@gnosis/db` via path aliases.
3. **Strip Tauri integration out of `apps/web`.** Remove `tauri`, `desktop:dev`, `desktop:build` from `apps/web/package.json`'s scripts; remove `@tauri-apps/cli` from its devDependencies. `apps/web` is back to being a plain Next.js landing page (deferred to issue W1).
4. **Reset `apps/web/page.tsx`** to a "coming soon" placeholder so turbo `build` doesn't error.
5. **Rename `apps/native` → `apps/mobile`.** Update `package.json` `name` field, root script `dev:native` → `dev:mobile`. Defer all feature work; scaffold only.
6. **Rename `apps/fumadocs` → `apps/docs`.** Update package name. Already runs on port 4000; leave it.
7. **Author `apps/desktop/vite.config.ts`** (full config in `12-tauri-and-platform.md`): React plugin, `@tailwindcss/vite`, `base: './'`, `build.outDir: 'dist'`, `server.port: 5173`, `server.strictPort: true`, path aliases for the workspace packages.
8. **Update `apps/desktop/src-tauri/tauri.conf.json`:**
   - Change `identifier` from `com.tauri.dev` to `dev.gnosis.app` (or similar; confirm domain).
   - Change `frontendDist` from `../out` (Next default) to `../dist` (Vite default).
   - Change `devUrl` from `http://localhost:3001` (Next port) to `http://localhost:5173` (Vite port).
   - Window default size 1280×800, not 800×600.
9. **Author `apps/desktop/package.json`:** scripts `dev: vite`, `build: vite build`, `tauri: tauri`, `tauri:dev: tauri dev`, `tauri:build: tauri build`. Deps: `react`, `react-dom`, `@gnosis/ui`, `@gnosis/core`, `@gnosis/editor`, `@gnosis/views`, `@gnosis/db`, `zustand`, `cmdk`, `@tanstack/react-virtual`, `tinykeys`, `chrono-node`, `ulid`, `date-fns`, `@tauri-apps/api`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-global-shortcut`, `@tauri-apps/plugin-os`, `@tauri-apps/plugin-log`, `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-clipboard-manager`. DevDeps: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `typescript`, `@tauri-apps/cli`, `vitest`.
10. **Add new workspace packages.** `packages/core`, `packages/editor`, `packages/views`, `packages/db`. Each gets a minimal `package.json` (workspace, type=module), `tsconfig.json` extending `@gnosis/config/tsconfig.base.json`, and a placeholder `src/index.ts`. No code, just plumbing.
11. **Add to bun catalog where shared:** `codemirror`, `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/search`, `@codemirror/autocomplete`, `@replit/codemirror-vim`, `zustand`, `cmdk`, `drizzle-orm`, `ulid`, `date-fns`, `chrono-node`. (No router; we are not using TanStack Router or React Router.)
12. **Update `turbo.json`:** add `tauri:dev` and `tauri:build` task targets scoped to `apps/desktop`. Add `test` task for packages with `cache: true` and inputs `src/**`.
13. **Update root `package.json` scripts:** `dev:desktop`, `dev:web`, `dev:docs`, `dev:mobile`. Drop `dev:native`. Add `tauri:dev` shortcut.
14. **Verify** `bun install` clean, `bun run check-types` clean, `bun run dev:desktop` brings up Tauri window with the placeholder Vite shell. This is the "scaffold-complete" gate.

## what stays untouched

- `biome.json` — already excludes `src-tauri`, `.next`, `routeTree.gen.ts`. Good.
- `.husky/` — pre-commit lint-staged is fine.
- `packages/config/tsconfig.base.json` — extends fine.
- `bts.jsonc` — left alone; it's BTS metadata.

## risks and unknowns

- **`@gnosis/ui` consumed from a Vite app.** `packages/ui` was authored against Next.js (uses `next-themes`). Verify the imports work in a Vite host: most components are framework-agnostic, but anything pulling `next/link` or `next/image` must be replaced with plain anchors and `<img>` tags inside `apps/desktop`. The shared primitives (`Button`, `Dialog`, `Command`) are clean and should work as-is.
- **Tailwind v4 in Vite vs Next.js.** Vite uses `@tailwindcss/vite`; Next uses `@tailwindcss/postcss`. Both consume the same `globals.css` token file from `packages/ui`. Verify on first build.
- **Path aliases across two build tools.** `apps/web` (Next.js) and `apps/desktop` (Vite) both alias `@gnosis/ui/*` → `../../packages/ui/src/*`. Each tool needs its own config (Next via `tsconfig.json` + Next's resolver; Vite via `vite.config.ts` `resolve.alias`).
- **Renaming `native` → `mobile` may break catalog refs or husky paths.** Grep for `apps/native` after the move; fix any stragglers.

## what is NOT in this restructure

- We are NOT moving `packages/ui` or rebuilding shadcn config. It already works.
- We are NOT setting up CI yet — that lives in `13-build-test-tooling.md`.
- We are NOT writing parser, editor, or palette code in this phase. This is plumbing only.
