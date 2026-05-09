# 05 — org parser

## scope

We parse a deliberately small subset of org-mode. Everything outside this list is preserved verbatim as opaque body text — round-tripped, not understood.

### in scope for MVP

- **Headings** with stars `*` to `******` (1–6 levels, but the parser permits any N).
- **TODO keywords:** `TODO`, `DONE`. (No custom keyword sets in MVP.)
- **Priority cookies:** `[#A]`, `[#B]`, `[#C]`.
- **Tags:** trailing `:foo:bar:` on heading lines.
- **Properties drawer:**
  ```
  :PROPERTIES:
  :ID:       01J9...
  :CREATED:  [2026-05-06 Wed 10:13]
  :END:
  ```
- **Planning line** under a heading:
  ```
  SCHEDULED: <2026-05-07 Thu 09:00>
  DEADLINE:  <2026-05-08 Fri>
  ```
- **Body text** = everything between this heading and the next heading at any level, minus drawers and the planning line.
- **File-level keywords:** `#+TITLE:`, `#+FILETAGS:` parsed and stored on the root row. Other `#+...` lines pass through untouched.
- **Org timestamps**: `<YYYY-MM-DD Day HH:MM>` and `[YYYY-MM-DD Day HH:MM]`. Both active and inactive forms.

### explicitly out of scope (DEFERRED — issue P1)

- Tables (`|...|...|`)
- Source blocks (`#+BEGIN_SRC ... #+END_SRC`)
- LaTeX fragments (`$...$`, `\begin{equation}`, `MathJax`)
- Footnotes (`[fn:1]`)
- Inline emphasis (`*bold*`, `/italic/`, `=verbatim=`)
- Links beyond round-trip (we treat `[[foo][bar]]` as opaque text in MVP)
- Repeating timestamps (`+1d`, `++1w`)
- Logbook drawer (`:LOGBOOK:`)
- Clock entries
- Archived subtrees
- Headlines with cookies `[1/3]`, `[33%]`

These all parse as body text and round-trip. We just don't query or render them specially.

## the AST

Every parsed file produces a `Document` with metadata and a flat list of `Block`s. We do not build a deep tree in MVP — heading depth is a number on each block. Children are derivable on demand by view code.

```
Document = {
  path: string
  title?: string                   // from #+TITLE
  fileTags: string[]               // from #+FILETAGS
  preamble: string                 // raw text before first heading
  blocks: Block[]
  raw: string                      // full original text, for round-trip diffing
}

Block = {
  id: string                       // ULID, from :ID: or freshly minted
  level: number                    // 1..N
  todo?: 'TODO' | 'DONE'
  priority?: 'A' | 'B' | 'C'
  title: string                    // heading text without TODO/priority/tags
  tags: string[]                   // both inherited file tags and local tags
  properties: Record<string, string>
  scheduled?: OrgTimestamp
  deadline?: OrgTimestamp
  body: string                     // raw body, drawers and planning stripped
  rangeInFile: { start: number, end: number }   // byte offsets
}

OrgTimestamp = {
  raw: string                      // for round-trip
  active: boolean                  // <> vs []
  date: string                     // YYYY-MM-DD
  time?: string                    // HH:MM
}
```

`raw: string` plus `rangeInFile` together let us write changes without re-emitting the whole file. We splice byte ranges.

## round-trip safety

The non-negotiable rule: parsing and re-emitting a block whose AST hasn't been semantically changed must produce **byte-identical** output for unedited blocks.

Approach: we don't ever re-emit blocks we didn't change. Edits go through targeted splices on `rawText`:

- Adding `:ID:` to a heading → splice insert under the heading line at the correct location, preserving existing whitespace.
- Toggling TODO → splice replace exactly the keyword token.
- Adding/removing tags → splice replace the trailing `:tag:tag:` region.
- Changing scheduling → splice replace the planning line, or insert if absent.
- Editing body in the editor → editor writes whole file (it owns the buffer).

We have one **write-the-whole-file** path: the editor. We have one **splice** path: the indexer's ID-minting and the palette's capture. The splice path is small enough to test exhaustively against fixtures.

## test corpus

A directory `packages/core/test/fixtures/` of pairs:
- `input.org` — what the user wrote.
- `expected-after-id-stamp.org` — what we should produce after first-pass ID minting.

Plus an "evil" fixture set:
- weird whitespace (tabs, trailing spaces, mixed line endings)
- pre-existing IDs we must not touch
- empty files, single-heading files, deeply nested headings
- non-ASCII titles
- a 200KB note (length stress)

A snapshot test: feed every fixture through the parser, re-emit, assert byte-equality with `input.org` (when no IDs need minting) or `expected-after-id-stamp.org`.

## tag inheritance

A block's effective tag set is `fileTags ∪ localTags ∪ tagsInheritedFromAncestorHeadings`. We compute the effective set at index time and store it (denormalized) on the block row, so views don't have to reconstruct it from the tree.

## priority and TODO state

Stored as columns on the block row. View queries can filter directly. `priority` is null for blocks without `[#X]`; `todo` is null for non-task blocks.

## scheduled vs deadline semantics

For agenda rendering:

- `SCHEDULED:` = the date the block "starts." Shows on that date going forward until DONE.
- `DEADLINE:` = the date the block is due. Shows from a configurable lead time (default: 7 days before) until done.

Both stored as ISO 8601 datetimes (the `time` field optional). Original `raw` preserved for round-trip.

## known unknowns

- **What if we encounter a syntax we don't model?** We pass it through as body text. Risk: a later edit re-emits in a normalized form that loses meaning. Mitigation: never re-emit body unless the user explicitly edited it via the editor (which writes whole file from CodeMirror's buffer — what they see is what they get).
- **Should we use an existing parser like `orga` or `uniorg`?** Both exist on npm. Tradeoffs: wider syntax coverage, but they emit different ASTs and round-trip is not their first goal. Resolution: spike `orga` against our fixture set during phase 5; if it round-trips cleanly under MVP scope, use it; otherwise hand-write the parser. Either way, our `Block` type is the public contract — the parser implementation is internal.
- **Property values with multi-line content.** The org spec allows them via continuation. We do not in MVP. We accept single-line property values only and warn on multi-line.

## interface

```
parse(rawText: string, sourcePath: string): { document: Document, warnings: ParseWarning[] }

mintIds(rawText: string): { newText: string, mintedCount: number }

emitToggleTodo(rawText: string, blockId: string, target: 'TODO' | 'DONE' | null): string

emitSetSchedule(rawText: string, blockId: string, ts: OrgTimestamp | null): string

emitSetTags(rawText: string, blockId: string, tags: string[]): string

emitAppendBlock(rawText: string, block: NewBlock): string  // for capture
```

All emit functions take the original raw text and return new raw text via splices. No AST → string round-trip. This is what makes round-trip safety achievable.

Date inputs from natural-language capture (chrono-node — see `09-command-palette.md`) are normalized to org-mode active-timestamp syntax (`<YYYY-MM-DD Day HH:MM>`) by a small `formatOrgTimestamp(date, { active })` helper inside `@gnosis/core` before being passed to `emitSetSchedule` or `emitAppendBlock`. The parser only ever sees org syntax; chrono lives at the palette boundary.

## what we are NOT building

- A bidirectional sync to org-mode upstream. We track a small subset; we don't try to be Emacs.
- Validation UI. Warnings go to logs and a "Recently parsed with warnings" palette command.
- A grammar file. The parser is hand-rolled or wraps `orga`. No PEG / Lezer for org in MVP. (Lezer is for the editor's syntax highlighter, deferred.)
