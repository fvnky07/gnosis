<!--
Thanks for the PR. The plan in `planning/` is the source of truth for what's
in / out of scope. Link the relevant phase doc when it applies.
-->

## Summary

<!-- One paragraph: what changed and why. -->

## Linked planning / issue

<!-- e.g. `planning/04-vault-and-indexer.md`, `#42`, deferred-issue tag like
     `V2`, `P1`, `E1`. Use `Fixes #N` to auto-close on merge. -->

## Scope

- [ ] Code change is scoped to a single concern
- [ ] No unrelated refactors smuggled in
- [ ] No new external dependencies (or, if added, justified below)

## Verification

```bash
bun run check-types
bun run check
bun run test
bun run build
```

- [ ] All four commands pass locally
- [ ] If UI changed: launched `bun run tauri:dev` (or `bun run dev:desktop`)
      and verified the user-facing flow

## Risk

<!-- What's the worst that happens if this regresses? Round-trip safety,
     ULID stamping, capability scopes, and SQLite migrations are the
     hot zones — call out which (if any) this PR touches. -->

## Screenshots / recordings

<!-- Drop a clip or stills if you touched the editor, palette, sidebar, or
     status bar. Optional otherwise. -->
