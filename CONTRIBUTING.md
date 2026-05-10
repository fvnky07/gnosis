# Contributing to gnosis

The implementation plan in [`planning/`](./planning) is the canonical roadmap. Before opening an issue or PR, skim [`planning/01-overview-and-mvp.md`](./planning/01-overview-and-mvp.md) and [`planning/14-roadmap-and-deferred.md`](./planning/14-roadmap-and-deferred.md) so we don't relitigate scope.

## Ground rules

- **Files are truth.** The `.org` vault is the source of truth; SQLite is a derived index. Anything that risks losing user data is the highest-priority class of bug.
- **Round-trip safety.** Edits to a `.org` file must preserve the rest of the file byte-for-byte. See [`planning/05-org-parser.md`](./planning/05-org-parser.md).
- **No file tree, no left sidebar, no menu of buttons.** The palette is the moat. If a new feature needs a button, it probably needs a palette command instead. See [`planning/01-overview-and-mvp.md`](./planning/01-overview-and-mvp.md) §"guiding constraints".
- **Defer aggressively.** When in doubt, file a deferred-issue tracker entry rather than a PR.

## Setup

```bash
bun install
bun run tauri:dev    # native window with sqlite + dialog wired
# or
bun run dev:desktop  # vite-only shell, no Tauri APIs
```

First Tauri compile takes 5–10 minutes. Subsequent runs are fast.

## Workflow

1. **Open an issue first** for anything non-trivial. Link the relevant planning doc.
2. **Branch off `dev`.** PRs target `dev`; `main` is for release cuts.
3. **Keep PRs small.** One concern per PR. No drive-by refactors.
4. **Write tests** for parser, indexer, palette, and capture changes. The `MemoryVault` in `@gnosis/core` makes side-effect testing cheap.
5. **Run all four checks before pushing:**

   ```bash
   bun run check-types
   bun run check
   bun run test
   bun run build
   ```

6. **Manually verify UI changes** with `bun run tauri:dev`. CI cannot test the desktop binary.

## Commit style

- Conventional Commits: `feat(scope): …`, `fix(scope): …`, `chore(deps): …`, `docs: …`.
- Subject line under 72 chars, imperative mood. Body explains the *why*.
- One logical change per commit. Stack with `git rebase -i` rather than amending shipped commits.

## Hot zones (extra-careful review)

| Area | Why |
|------|-----|
| `packages/core/src/parser/` | Round-trip safety. Splice-based emitters; no AST → string re-emits. |
| `packages/core/src/capture/` | Writes to user files. Mistakes corrupt daily notes. |
| `apps/desktop/src-tauri/capabilities/` | Filesystem and dialog scopes. Widening here loosens the security boundary. |
| `packages/db/src/migrations.ts` | SQLite schema. Migrations must be additive; existing user databases get them on next launch. |
| ULID minting (`mint-ids.ts`) | First write to a fresh org file. Must preserve every other byte. |

## Reporting security issues

Please do not file public issues for security-sensitive bugs. See [`SECURITY.md`](./SECURITY.md).

## License

By contributing you agree your contributions are licensed under the [MIT license](./LICENSE) of this repository.
