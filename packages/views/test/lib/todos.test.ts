import { describe, expect, it } from "vitest";
import {
	buildKanbanColumns,
	classifyKanban,
	sortTodosListMode,
} from "../../src/lib/todos";
import type { ViewBlock } from "../../src/types";

function block(id: string, overrides: Partial<ViewBlock> = {}): ViewBlock {
	return {
		id,
		filePath: "x.org",
		level: 1,
		headlineRaw: `* TODO ${id}`,
		body: "",
		todoState: "TODO",
		priority: null,
		scheduled: null,
		deadline: null,
		closed: null,
		tags: [],
		...overrides,
	};
}

const NOW = new Date(2026, 4, 10, 12, 0);

describe("classifyKanban", () => {
	it("returns null for non-task blocks", () => {
		expect(classifyKanban(block("x", { todoState: null }))).toBeNull();
	});
	it("DONE → done", () => {
		expect(
			classifyKanban(block("x", { todoState: "DONE" }), { now: NOW }),
		).toBe("done");
	});
	it("TODO with no schedule and no deadline → backlog", () => {
		expect(classifyKanban(block("x"), { now: NOW })).toBe("backlog");
	});
	it("TODO with SCHEDULED ≤ today → active", () => {
		expect(
			classifyKanban(block("x", { scheduled: "<2026-05-10 Sun>" }), {
				now: NOW,
			}),
		).toBe("active");
		expect(
			classifyKanban(block("x", { scheduled: "<2026-05-08 Fri>" }), {
				now: NOW,
			}),
		).toBe("active");
	});
	it("TODO with future SCHEDULED → backlog", () => {
		expect(
			classifyKanban(block("x", { scheduled: "<2026-06-01 Mon>" }), {
				now: NOW,
			}),
		).toBe("backlog");
	});
	it("TODO with DEADLINE within lead window → active", () => {
		expect(
			classifyKanban(block("x", { deadline: "<2026-05-15 Fri>" }), {
				now: NOW,
				deadlineLeadDays: 7,
			}),
		).toBe("active");
	});
	it("TODO with DEADLINE far beyond lead window → backlog", () => {
		expect(
			classifyKanban(block("x", { deadline: "<2026-12-31 Thu>" }), {
				now: NOW,
				deadlineLeadDays: 7,
			}),
		).toBe("backlog");
	});
});

describe("buildKanbanColumns", () => {
	it("bins blocks into the three columns", () => {
		const blocks = [
			block("done", { todoState: "DONE" }),
			block("active", { scheduled: "<2026-05-10 Sun>" }),
			block("backlog"),
			block("not-task", { todoState: null }),
		];
		const cols = buildKanbanColumns(blocks, { now: NOW });
		expect(cols.find((c) => c.id === "done")?.blocks.map((b) => b.id)).toEqual([
			"done",
		]);
		expect(
			cols.find((c) => c.id === "active")?.blocks.map((b) => b.id),
		).toEqual(["active"]);
		expect(
			cols.find((c) => c.id === "backlog")?.blocks.map((b) => b.id),
		).toEqual(["backlog"]);
	});
});

describe("sortTodosListMode", () => {
	it("orders TODO before DONE", () => {
		const out = sortTodosListMode([
			block("done", { todoState: "DONE" }),
			block("todo", { todoState: "TODO" }),
		]);
		expect(out.map((b) => b.id)).toEqual(["todo", "done"]);
	});
	it("orders by priority A → B → C → none within the same todo state", () => {
		const out = sortTodosListMode([
			block("c", { priority: "C" }),
			block("a", { priority: "A" }),
			block("none"),
			block("b", { priority: "B" }),
		]);
		expect(out.map((b) => b.id)).toEqual(["a", "b", "c", "none"]);
	});
	it("orders by deadline ascending after priority tie", () => {
		const out = sortTodosListMode([
			block("late", { deadline: "<2026-12-31 Thu>" }),
			block("early", { deadline: "<2026-06-01 Mon>" }),
		]);
		expect(out.map((b) => b.id)).toEqual(["early", "late"]);
	});
	it("orders by createdMs descending as the final tiebreaker", () => {
		const out = sortTodosListMode([
			block("old", { createdMs: 1 }),
			block("new", { createdMs: 100 }),
		]);
		expect(out.map((b) => b.id)).toEqual(["new", "old"]);
	});
});
