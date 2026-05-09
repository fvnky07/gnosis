# 13 — build, test, tooling

## what BTS already gave us

- **Biome 2.2** with formatter (tab indent, double quotes), organize-imports on save, recommended ruleset, plus a few overrides. `src-tauri` and generated files are excluded.
- **Husky 9** with `prepare` script.
- **lint-staged** matched on JS/TS/JSON.
- **Turborepo 2.8** with tasks `build`, `lint`, `check-types`, `dev`.
- **bun 1.3** as package manager.
- **catalog** of shared dep versions.
- **TS 6 strict** via `packages/config/tsconfig.base.json`.

We don't fight any of this. We layer testing and CI onto it.

## the testing layers

| Layer | Tool | Where | Trigger |
|-------|------|-------|---------|
| Unit (pure TS) | Vitest | `packages/core/test/`, `packages/db/test/` | per-package `test` script |
| Component | Vitest + React Testing Library | `packages/views/test/`, `packages/editor/test/` | per-package `test` script |
| E2E (desktop) | Playwright + tauri-driver | `apps/desktop/e2e/` | nightly + manual |
| Manual smoke | A documented checklist | `planning/14-roadmap-and-deferred.md` | every release |

We consciously avoid:

- Jest. Vitest is faster, ESM-native, and matches Vite's ecosystem.
- Cypress for desktop. Playwright drives the Tauri webview better via `webdriver`.
- Storybook in MVP. Worth it later when the component library matures.

## test budgets

- **Parser**: high coverage. Round-trip fixtures are the canary; every supported syntax has a fixture pair. Aim for ≥90% line coverage in `packages/core/src/parser/`.
- **Indexer**: integration tests with `MemoryVault` and an in-memory DB.
- **Views**: 1–2 happy-path tests per view, asserting query → render. Not pixel-perfect.
- **Palette**: smoke test that each provider matches its trigger and submits without error.
- **Editor**: smoke test that buffer text round-trips through CodeMirror without surprise transforms.
- **E2E**: one happy-path script: pick vault → capture journal → see in journal view → restart → still there.

## CI

GitHub Actions, three workflows:

### `.github/workflows/check.yml`
On every PR:
- `bun install`
- `bun run check` (Biome)
- `bun run check-types`
- `bun run --filter "*" test` (unit + component)
- macos-latest only initially. Add ubuntu/windows when their builds matter.

### `.github/workflows/desktop-build.yml`
On `main` push and tags:
- `bun install`
- `bun run --filter desktop build`
- `bun run --filter desktop tauri:build`
- Upload artifacts (no signing yet — issue B1).

### `.github/workflows/release.yml`
On tag `v*`:
- Builds for macOS (universal), Windows, Linux.
- Drafts a GitHub release with the artifacts.
- Manual publish gate.

CI is **not** in MVP scope strictly — issue B3 covers full CI. We start with `check.yml` only.

## scripts and conventions

Root `package.json` updates after the scaffold delta:

```jsonc
{
  "scripts": {
    "dev": "turbo dev",
    "dev:desktop": "turbo -F desktop dev",
    "dev:web": "turbo -F web dev",
    "dev:docs": "turbo -F docs dev",
    "dev:mobile": "turbo -F mobile dev",
    "build": "turbo build",
    "tauri:dev": "turbo -F desktop tauri:dev",
    "tauri:build": "turbo -F desktop tauri:build",
    "test": "turbo test",
    "check-types": "turbo check-types",
    "check": "biome check --write .",
    "prepare": "husky"
  }
}
```

`turbo.json` adds:

```jsonc
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "test/**", "package.json"],
      "outputs": []
    },
    "tauri:dev": {
      "cache": false,
      "persistent": true
    },
    "tauri:build": {
      "dependsOn": ["^build"],
      "outputs": ["src-tauri/target/release/bundle/**"]
    }
  }
}
```

## pre-commit

Husky + lint-staged already wire `biome check --write` on staged files. We add:

- Lint-staged for `*.org` is **off**. The user's content is not subject to our linter.
- Optional: a hook that runs `bun run --filter @gnosis/core test:parser-round-trip` before committing parser changes. Off by default to keep commits fast; we recommend `pre-push` for that one.

## type checking

`packages/config/tsconfig.base.json` is the source. Each package's `tsconfig.json` extends it. `apps/desktop` has its own `tsconfig.json` authored fresh for the Vite scaffold (React JSX, ESNext modules, no Next-specific compiler plugins) with path aliases to the new packages:

```jsonc
{
  "paths": {
    "@/*": ["./src/*"],
    "@gnosis/ui/*": ["../../packages/ui/src/*"],
    "@gnosis/core/*": ["../../packages/core/src/*"],
    "@gnosis/editor/*": ["../../packages/editor/src/*"],
    "@gnosis/views/*": ["../../packages/views/src/*"],
    "@gnosis/db/*": ["../../packages/db/src/*"]
  }
}
```

We do not publish these packages; they are workspace-only.

## linting deviations from BTS defaults

We accept BTS's biome config as-is. The one rule we may relax later: `useExhaustiveDependencies` (currently `info`). Some CodeMirror integrations intentionally pin deps; we'll address case-by-case.

## documentation

- Each package gets a one-page `README.md` summarizing its exports.
- `apps/desktop/README.md` documents how to run, build, and debug.
- The Fumadocs site under `apps/docs` is **deferred** content-wise; the app builds, but the docs themselves are issue W2.

## known unknowns

- **Vitest + React 19 + Tailwind 4 setup quirks.** Probably none, but verify in the first test write. The `@testing-library/react` for React 19 is new. Vitest piggybacks on the same `vite.config.ts` — no separate config needed for `apps/desktop` and the workspace packages, which simplifies the harness.
- **Playwright + tauri-driver on macOS.** Setup is finicky; we accept up to a half-day spike before declaring E2E in scope. If it doesn't go cleanly, E2E becomes issue T1.
- **Bun's compatibility with Vitest's worker model.** Vitest works under bun in our experience; verify in the first commit that adds tests.

## what's NOT in this plan

- No coverage gating in CI in MVP. We'll add it once the test suite is mature.
- No mutation testing, no property-based testing (worth considering for the parser later).
- No bundle-size budgets enforced in CI yet (issue T2).
- No telemetry. The app does not phone home. Period.
