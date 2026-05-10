import type { ViewBlock } from "../types";
import { parseOrgDate, startOfDay } from "./relative-date";

export type KanbanColumnId = "backlog" | "active" | "done";

export interface KanbanColumn {
	id: KanbanColumnId;
	title: string;
	blocks: ViewBlock[];
}

export interface ClassifyOptions {
	now?: Date;
	/** Days before deadline that a card surfaces in Active. */
	deadlineLeadDays?: number;
}

/**
 * Bin a block into one of the kanban columns per `planning/10-views.md`:
 *
 * - **Backlog**: TODO with no SCHEDULED and no DEADLINE.
 * - **Active**: TODO with SCHEDULED ≤ today, OR with DEADLINE within
 *   `deadlineLeadDays` (default 7) of today.
 * - **Done**: todoState === DONE.
 *
 * Returns `null` for non-task blocks (no `todoState`).
 */
export function classifyKanban(
	block: ViewBlock,
	options: ClassifyOptions = {},
): KanbanColumnId | null {
	if (block.todoState === "DONE") return "done";
	if (block.todoState !== "TODO") return null;
	const now = options.now ?? new Date();
	const leadDays = options.deadlineLeadDays ?? 7;
	const today = startOfDay(now).getTime();
	const scheduled = parseOrgDate(block.scheduled);
	const deadline = parseOrgDate(block.deadline);
	const scheduledActive =
		scheduled !== null && startOfDay(scheduled).getTime() <= today;
	const deadlineActive =
		deadline !== null &&
		startOfDay(deadline).getTime() <= today + leadDays * 24 * 60 * 60 * 1000;
	if (scheduledActive || deadlineActive) return "active";
	return "backlog";
}

export function buildKanbanColumns(
	blocks: ViewBlock[],
	options: ClassifyOptions = {},
): KanbanColumn[] {
	const columns: Record<KanbanColumnId, ViewBlock[]> = {
		backlog: [],
		active: [],
		done: [],
	};
	for (const block of blocks) {
		const col = classifyKanban(block, options);
		if (col) columns[col].push(block);
	}
	return [
		{ id: "backlog", title: "Backlog", blocks: columns.backlog },
		{ id: "active", title: "Active", blocks: columns.active },
		{ id: "done", title: "Done", blocks: columns.done },
	];
}

/**
 * Sort blocks for the todos list mode per `planning/10-views.md`:
 *
 * 1. todo state: TODO before DONE
 * 2. priority: A, B, C, none
 * 3. deadline ascending
 * 4. scheduled ascending
 * 5. createdMs descending (best-effort)
 */
export function sortTodosListMode(blocks: ViewBlock[]): ViewBlock[] {
	const PRIORITY_ORDER: Record<string, number> = {
		A: 0,
		B: 1,
		C: 2,
		"": 3,
	};
	return [...blocks].sort((a, b) => {
		const todoOrder = todoRank(a) - todoRank(b);
		if (todoOrder !== 0) return todoOrder;
		const aPri = PRIORITY_ORDER[a.priority ?? ""] ?? 3;
		const bPri = PRIORITY_ORDER[b.priority ?? ""] ?? 3;
		if (aPri !== bPri) return aPri - bPri;
		const aDead =
			parseOrgDate(a.deadline)?.getTime() ?? Number.POSITIVE_INFINITY;
		const bDead =
			parseOrgDate(b.deadline)?.getTime() ?? Number.POSITIVE_INFINITY;
		if (aDead !== bDead) return aDead - bDead;
		const aSched =
			parseOrgDate(a.scheduled)?.getTime() ?? Number.POSITIVE_INFINITY;
		const bSched =
			parseOrgDate(b.scheduled)?.getTime() ?? Number.POSITIVE_INFINITY;
		if (aSched !== bSched) return aSched - bSched;
		return (b.createdMs ?? 0) - (a.createdMs ?? 0);
	});
}

function todoRank(block: ViewBlock): number {
	if (block.todoState === "TODO") return 0;
	if (block.todoState === "DONE") return 1;
	return 2;
}
