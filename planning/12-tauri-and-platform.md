# 12 — tauri and platform

## targets

- **macOS** (universal): the primary platform. Signed + notarized builds for distribution. Min macOS 11.
- **Windows**: unsigned dev builds. We do not pay for an EV cert in MVP. Documented as "right-click → run anyway." Issue B1 covers code signing.
- **Linux**: AppImage and `.deb` from CI. Lowest priority; left to community testing.

## plugins we add (delta from current scaffold)

The scaffold has only `tauri-plugin-log`. We add:

| Plugin | Purpose | JS package | Rust crate |
|--------|---------|-----------|-----------|
| `tauri-plugin-fs` | read/write `.org` files in vault | `@tauri-apps/plugin-fs` | `tauri-plugin-fs` |
| `tauri-plugin-sql` | SQLite for the index | `@tauri-apps/plugin-sql` (sqlite feature) | `tauri-plugin-sql` |
| `tauri-plugin-dialog` | folder picker, message boxes | `@tauri-apps/plugin-dialog` | `tauri-plugin-dialog` |
| `tauri-plugin-global-shortcut` | OS-level capture hotkey | `@tauri-apps/plugin-global-shortcut` | `tauri-plugin-global-shortcut` |
| `tauri-plugin-store` | tiny key-value config (or use `app_state` table) | `@tauri-apps/plugin-store` | `tauri-plugin-store` |
| `tauri-plugin-os` | OS detection for theme + paths | `@tauri-apps/plugin-os` | `tauri-plugin-os` |
| `tauri-plugin-prevent-default` | Suppress browser-default chords (Cmd+R, Cmd+F, context menu, devtools) so vim chords aren't eaten by the webview. See `15-vim-mode.md`. | n/a (Rust-only) | `tauri-plugin-prevent-default` |
| `tauri-plugin-clipboard-manager` | Reliable yank-to-system-clipboard fallback (`set clipboard=unnamed` semantics). Used only if `navigator.clipboard.writeText` proves unreliable in WKWebView. | `@tauri-apps/plugin-clipboard-manager` | `tauri-plugin-clipboard-manager` |

`tauri-plugin-store` is optional — we already have `app_state` in SQLite. Decision: skip it; one less plugin. Settings live in SQLite via `appState.set/get`.

## capabilities (per-plugin allowlists)

Tauri 2 requires explicit capabilities. We replace the default `default.json` with a set of files keyed by surface. All target the `main` window.

### `capabilities/main.json` (always allowed)

- `core:default`
- `dialog:allow-open`           // for vault picker
- `dialog:allow-message`        // for warnings (re-run after corrupt index, etc)
- `os:allow-platform`
- `os:allow-os-type`
- `global-shortcut:allow-register`
- `global-shortcut:allow-unregister`
- `log:default`

### `capabilities/vault.json` (scoped to the user-picked vault)

The tricky part: we don't know the vault path at build time. Tauri 2 supports runtime scope additions via `tauri::scope::fs::Scope::allow_directory()` from Rust. Two paths:

1. **Hand-rolled Rust command** that takes the user-picked path, validates it, and adds it to the FS scope at runtime. Then JS-side `fs:allow-read-file` and `fs:allow-write-file` can target paths under it.
2. **Broad `$HOME` scope** via `fs:scope-home-recursive` capability and trust the JS layer to keep operations under the picked vault.

Option 1 is correct. Option 2 is fast. We start with **option 1** because it preserves Tauri's promise of a constrained filesystem; option 2 only as fallback if we hit blockers in CI signing or sandboxing.

The Rust addition is small: a `set_vault_path(path)` command exposed via `#[tauri::command]`. This is the only custom Rust we plan to write in MVP.

### `capabilities/sql.json`

- `sql:allow-load`               // open the gnosis.sqlite db
- `sql:allow-execute`
- `sql:allow-select`
- `sql:allow-close`

The DB path is `$APP_DATA/gnosis.sqlite`. AppData is always allowed under the plugin's default scope.

## vite.config.ts settings

`apps/desktop` is a Vite + React app. NOT Next.js. The Next.js → Vite swap happens in phase 0 (see `03-monorepo-and-scaffold-delta.md`); the entire class of `output: 'export'` / `reactCompiler` / `typedRoutes` / `next/image` constraints does not apply.

Minimum config:

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwind from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [react(), tailwind()],
  base: "./",                                 // Tauri loads from file:// — relative URLs only
  build: {
    outDir: "dist",
    target: "esnext",
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    // tauri dev runs vite; if 5173 is taken we'd rather fail than drift
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@gnosis/core": path.resolve(__dirname, "../../packages/core/src"),
      "@gnosis/editor": path.resolve(__dirname, "../../packages/editor/src"),
      "@gnosis/views": path.resolve(__dirname, "../../packages/views/src"),
      "@gnosis/db": path.resolve(__dirname, "../../packages/db/src"),
      "@gnosis/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
})
```

Notes:
- `base: './'` is non-negotiable for Tauri's `file://` loader. Absolute paths like `/assets/foo.js` won't resolve in production builds.
- Fonts ship as static assets imported from `apps/desktop/src/fonts/` (Inter + a monospace). No CDN, no external font loaders — this app must work offline.
- Vite's dev server speaks HMR over WebSocket on port 5173; Tauri dev points at it.
- `apps/web` (the landing page) stays on Next.js with its own config. Vite swap is `apps/desktop`-only.

## tauri.conf.json updates

From the current scaffold (`apps/web/src-tauri/tauri.conf.json`, moved to `apps/desktop/src-tauri/` in phase 0):

```diff
- "identifier": "com.tauri.dev"
+ "identifier": "dev.gnosis.app"

- "frontendDist": "../out"
+ "frontendDist": "../dist"        // Vite outDir, not Next export

- "devUrl": "http://localhost:3001"
+ "devUrl": "http://localhost:5173"  // Vite dev port

  "beforeDevCommand": "bun run dev"        // unchanged — runs vite
  "beforeBuildCommand": "bun run build"    // unchanged — runs vite build

- "windows": [{ "width": 800, "height": 600 }]
+ "windows": [{
+   "title": "gnosis",
+   "width": 1280,
+   "height": 800,
+   "minWidth": 800,
+   "minHeight": 600,
+   "decorations": true,
+   "fullscreen": false,
+   "transparent": false
+ }]
+ "security": {
+   "csp": "default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
+ }
+ "withGlobalTauri": false
```

CSP is conservative. We tighten further once we measure (e.g., remove `unsafe-inline` once we confirm no inline-style emission from any consumed package).

`beforeDevCommand` runs Vite (via `bun run dev` in `apps/desktop`). `beforeBuildCommand` runs `vite build`. Both work transparently after the phase 0 split.

## packaging

- macOS: `.app` and `.dmg` via `tauri build`. Universal arm64+x86_64. Code signing requires Apple Developer ID; configured via env vars in CI (deferred to issue B1).
- Windows: `.msi` via WiX. Unsigned in MVP.
- Linux: `.AppImage` and `.deb`. Distributed from GitHub releases.

Auto-update with `tauri-plugin-updater` is **deferred** (issue B2).

## icons

The scaffold has placeholder icons in `src-tauri/icons/`. We will generate real icons from a master `gnosis.svg` using `cargo tauri icon`. This is a five-minute task in the polish phase.

## developer workflow

- `bun run dev:desktop` → starts Vite on `:5173` and Tauri webview. HMR on the JS side; Rust changes restart the webview.
- `bun run check-types` runs across the workspace.
- `bun run check` runs Biome.
- `bun run --filter @gnosis/core test` runs unit tests for that package.

Tauri-side debugging uses `tauri-plugin-log` with file output to `$APP_DATA/logs/gnosis.log`. We surface "Open log file" as a palette command.

## known unknowns and risks

- **`tauri-plugin-sql` API for parameterized queries with `IN (...)` lists.** Verified by a 30-min spike during phase 4. Fallback: dynamic SQL string with safe param expansion.
- **macOS code signing flow.** Setup time can balloon. Defer to issue B1 — MVP can ship as ad-hoc signed during private alpha.
- **Vite + Tauri asset paths.** `base: './'` is required for the file:// loader; verify on the first `tauri build` that the bundle resolves CSS, font, and chunk URLs correctly. (This replaces the old static-export / React-Compiler / typedRoutes risks — none of those apply to Vite.)
- **Vault path containing spaces or unicode.** Tauri scope scope handles these but path joining must be careful. Test with a vault path like `~/Documents/My Vault — Gnosis/` early in phase 4.
- **Webview2 missing on Windows.** Tauri prompts to install. Documented in the README.
- **Cmd+W and the macOS window manager.** WKWebView passes `Cmd+W` to the OS before JS sees it. We handle window close via Rust's `WindowEvent::CloseRequested` and route it through buffer-close logic (close the active buffer; close the window only when the last buffer would close — Neovim pattern). See `15-vim-mode.md`.
- **IME composition + vim normal mode.** WKWebView IME composition events fire alongside `keydown`, which can confuse cm-vim. Editor wraps with `compositionstart`/`compositionend` listeners that suspend vim's normal-mode handling during composition.
- **Keyboard event delivery on first paint.** Tauri issue #5464 — keyboard events may not reach JS until a click. Mitigation: call `window.focus()` on the Tauri `did-finish-load` event.

## what we are NOT building

- No custom Rust commands beyond `set_vault_path`.
- No native menus in MVP (we keep the default Tauri menu; custom menu is issue U3).
- No tray icon (issue U4).
- No notifications API integration (issue U5).
- No deeplinks (issue U6).
- No auto-update (issue B2).
