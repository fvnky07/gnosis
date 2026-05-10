import { describe, expect, it } from "vitest";
import {
	filterJournalBlocks,
	groupJournalBlocksByDay,
} from "../../src/lib/journal";
import type { ViewBlock } from "../../src/types";

function block(id: string, tags: string[], createdMs?: number): ViewBlock {
	return {
		id,
		filePath: "test.org",
		level: 1,
		headlineRaw: `* ${id}`,
		body: "",
		todoState: null,
		priority: null,
		scheduled: null,
		deadline: null,
		closed: null,
		createdMs,
		tags,
	};
}

const ANCHOR = new Date(2026, 4, 10, 14, 0);
const TODAY = new Date(2026, 4, 10, 9, 0).getTime();
const YESTERDAY = new Date(2026, 4, 9, 18, 0).getTime();
const TWO_DAYS_AGO = new Date(2026, 4, 8, 8, 0).getTime();

describe("filterJournalBlocks", () => {
	it("returns only blocks tagged journal", () => {
		const a = block("a", ["journal"]);
		const b = block("b", ["work"]);
		expect(filterJournalBlocks([a, b])).toEqual([a]);
	});
});

describe("groupJournalBlocksByDay", () => {
	it("groups by local-day floor and labels Today/Yesterday", () => {
		const blocks = [
			block("a", ["journal"], TODAY),
			block("b", ["journal"], YESTERDAY),
			block("c", ["journal"], TWO_DAYS_AGO),
		];
		const groups = groupJournalBlocksByDay(blocks, ANCHOR);
		expect(groups.map((g) => g.dayLabel)).toEqual([
			"Today",
			"Yesterday",
			expect.stringContaining("Friday"),
		]);
	});
	it("orders blocks within a day newest-first", () => {
		const earlier = block("early", ["journal"], TODAY);
		const later = block("late", ["journal"], TODAY + 60_000);
		const groups = groupJournalBlocksByDay([earlier, later], ANCHOR);
		expect(groups[0].blocks.map((b) => b.id)).toEqual(["late", "early"]);
	});
	it("collects undated blocks under 'Older'", () => {
		const groups = groupJournalBlocksByDay(
			[block("a", ["journal"]), block("b", ["journal"], TODAY)],
			ANCHOR,
		);
		const older = groups.find((g) => g.dayLabel === "Older");
		expect(older?.blocks.map((b) => b.id)).toEqual(["a"]);
	});
	it("returns [] for empty input", () => {
		expect(groupJournalBlocksByDay([], ANCHOR)).toEqual([]);
	});
});
