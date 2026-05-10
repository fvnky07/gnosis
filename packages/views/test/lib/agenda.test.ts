import { describe, expect, it } from "vitest";
import { computeAgenda } from "../../src/lib/agenda";
import type { ViewBlock } from "../../src/types";

function block(id: string, overrides: Partial<ViewBlock> = {}): ViewBlock {
	return {
		id,
		filePath: "x.org",
		level: 1,
		headlineRaw: `* ${id}`,
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

const ANCHOR = new Date(2026, 4, 10, 14, 0); // Sunday May 10 2026

describe("computeAgenda", () => {
	it("day mode produces a single slot for today", () => {
		const blocks = [
			block("today", { scheduled: "<2026-05-10 Sun>" }),
			block("tomorrow", { scheduled: "<2026-05-11 Mon>" }),
		];
		const range = computeAgenda(blocks, { mode: "day", now: ANCHOR });
		expect(range.slots).toHaveLength(1);
		expect(range.slots[0].blocks.map((b) => b.id)).toEqual(["today"]);
	});

	it("week mode covers Sunday through Saturday", () => {
		const range = computeAgenda([], { mode: "week", now: ANCHOR });
		expect(range.slots).toHaveLength(7);
		expect(range.slots[0].date.getDay()).toBe(0);
		expect(range.slots[6].date.getDay()).toBe(6);
	});

	it("month mode covers 6 weeks (42 days)", () => {
		const range = computeAgenda([], { mode: "month", now: ANCHOR });
		expect(range.slots).toHaveLength(42);
	});

	it("places SCHEDULED on the matching day", () => {
		const blocks = [block("a", { scheduled: "<2026-05-12 Tue 10:00>" })];
		const range = computeAgenda(blocks, { mode: "week", now: ANCHOR });
		const tueSlot = range.slots.find((s) => s.date.getDay() === 2);
		expect(tueSlot?.blocks.map((b) => b.id)).toEqual(["a"]);
	});

	it("places DEADLINE on the deadline day and the lead-in window", () => {
		const blocks = [block("d", { deadline: "<2026-05-15 Fri>" })];
		const range = computeAgenda(blocks, {
			mode: "week",
			now: ANCHOR,
			deadlineLeadDays: 7,
		});
		// Lead window covers all 7 days of the visible week (deadline May 15 is within range)
		const matching = range.slots.filter((s) => s.blocks.length > 0);
		expect(matching.length).toBeGreaterThan(0);
		expect(matching.every((s) => s.blocks.some((b) => b.id === "d"))).toBe(
			true,
		);
	});
});
