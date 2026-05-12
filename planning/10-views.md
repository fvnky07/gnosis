# 10 — views (journal, agenda, todos)

## where they live

All three views render in the **right sidebar**, never the center. They are tabs in `viewStore.rightTabs`. The center is always the editor. Multiple view tabs can stack; the user switches between them via tabs at the top of the right sidebar.

The right sidebar is wider than typical sidebars — design target 40–50% of viewport when open. Collapsible to zero width. Persisted per session.

## shared concerns

All views:

- Pull data from `@gnosis/db` via small query hooks (e.g. `useJournalQuery({ limit, offset })`).
- Subscribe to `indexEventBus` and refetch on relevant events (`'block.upserted'` etc).
- Render block snippets via `BlockSnippet` from `@gnosis/editor` (doc 08) for consistent typography.
- Send `bufferStore.openBuffer({ path, blockId })` on click — never replace the editor's content directly.

## journal view

### shape
Chronological feed of blocks tagged `:journal:`. Newest first. Grouped by day with a sticky header.

### query
```
SELECT id, path, title, body, tags, created_ms
FROM blocks
WHERE id IN (SELECT block_id FROM block_tags WHERE tag = 'journal')
ORDER BY created_ms DESC
LIMIT 50 OFFSET ?
```

Page size 50. Infinite scroll on bottom intersection. We hold pages in memory; on a large vault (>10k journal entries) this is fine because each row is small and we don't render all of them at once.

### rendering

```
[ Today, May 6 ]
  10:13  Long thought about parsers...
         Tags: :journal:
  09:01  Quick note about the week
         Tags: :journal: :weekly:

[ Yesterday, May 5 ]
  ...
```

Each entry is a card. Click → open the source file at that block. Hover → show small "open file" / "edit inline" buttons (with palette commands as the canonical actions).

### gestures
- Click card → open source.
- Cmd+click → open in new tab.
- Right-click → context menu of palette commands scoped to that block.

## agenda view

### shape
Calendar-style. Three sub-modes via tabs at the top: **Day**, **Week**, **Month**. Default Week.

### data
```
SELECT id, title, scheduled, scheduled_active, deadline, todo, priority, tags
FROM blocks
WHERE (scheduled BETWEEN :start AND :end)
   OR (deadline  BETWEEN :start AND :end)
ORDER BY COALESCE(scheduled, deadline)
```

Range:
- Day: 24h slots from 6am–11pm visible by default; scroll outside.
- Week: 7 columns × hourly rows; scheduled tasks placed at their time, all-day tasks in a banner row above the grid.
- Month: 6 rows × 7 columns; each day cell shows up to 3 chips, with "+N more" for overflow.

### rendering library

We do NOT pull `react-big-calendar` or `fullcalendar`. Both are heavy and opinionated. We render the grid by hand — it's a few hundred lines of Tailwind grid + pointer events.

### deadline visualization
Items with a `DEADLINE:` show on each day from `(deadline - leadDays)` through `deadline`. Color intensifies as the deadline approaches. Lead days configurable; default 7.

### scheduled vs all-day
A scheduled block with a `time` component places at that time slot. Without time → "all day" banner.

### interactions

- Click a chip → open source block in editor.
- Click an empty time slot → palette opens in capture mode pre-filled with `t  <timestamp> ` so user types the task title.
- Drag a chip to another time/day (DEFERRED — issue V3, hard to round-trip without bugs).

### priority visualization
Color stripe on the left edge of the chip: red `[#A]`, orange `[#B]`, gray `[#C]`. None → no stripe.

## todos view

### shape
Two modes, user-toggleable: **Kanban** (default) and **List**.

### kanban columns
- **Backlog**: `todo = 'TODO'` AND no `SCHEDULED` AND no `DEADLINE`.
- **Active**: `todo = 'TODO'` AND has `SCHEDULED ≤ today` OR has `DEADLINE ≤ today + leadDays`.
- **Done**: `todo = 'DONE'`, ordered by most recently changed (we approximate via file mtime; precise change tracking deferred).

### list mode
Flat list. Sorted by:
1. todo state: TODO before DONE
2. priority: A, B, C, none
3. deadline ascending
4. scheduled ascending
5. created descending

### card content
- Title
- Tags (small chips)
- Priority badge
- Scheduled / deadline as a relative phrase ("Tomorrow", "Friday", "Overdue 2d")
- Source file as a subtle subtitle

### interactions

- Click card → open source.
- Drag between columns → updates state via `core.toggleTodo(blockId, target)` which produces a splice and writes the file.
- Cmd+Enter on a focused card → toggles TODO/DONE.
- Right-click → palette commands scoped to the block (set priority, schedule, etc).

The drag interaction needs care: a drop must commit the file write before the UI moves the card. We render optimistically and rollback on error (rare but possible if the file is missing or unreadable).

## tab management

The right sidebar has a tabs row. Each tab shows an icon + label.

- Open a view via `v journal` in the palette.
- Close via tab `×` or palette command `View: Close current tab`.
- Reorder by drag (small affordance).
- Persisted to `app_state.views.rightTabs`.

## empty states

- Journal empty → "Capture your first journal entry: ⌘K → `j hello`."
- Agenda empty → "No scheduled or deadline blocks in this range."
- Todos empty → "No TODOs yet. ⌘K → `t buy milk` to start."

## what's NOT in views in MVP

- No grouping by tag/project beyond date in the journal.
- No filtering UI (filters live in the palette as `view query` commands — deferred to v0.2 saved-queries feature, issue V4).
- No pomodoro / time-tracking.
- No graph view, no backlinks panel, no canvas. (Issue V5.)
- No drag-drop in the agenda.
- No CSV/markdown export.

## known unknowns

- **Calendar grid performance with hundreds of items per week.** Probably fine; we virtualize rows if needed (deferred).
- **Reordering DONE → TODO in kanban.** Does this remove `closed` semantics? In MVP, dragging DONE → Active rewrites TODO and removes any auto-recorded close timestamp. We don't track close timestamps explicitly until v0.2.
- **Time zones.** All timestamps stored as the user's local time per org-mode convention. We do not convert. If the user moves time zones, agenda dates may surprise them. Documented; deferred.
