import { describe, expect, it } from "vitest";
import {
	parseOrgTimestamp,
	viewBlocksToScheduleXEvents,
} from "../../src/lib/schedule-x-adapter";
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

describe("parseOrgTimestamp", () => {
	it("returns all-day for a bare date", () => {
		expect(parseOrgTimestamp("<2026-05-10>")).toEqual({
			startISO: "2026-05-10",
			endISO: "2026-05-10",
			allDay: true,
		});
	});

	it("tolerates an org day-name token", () => {
		expect(parseOrgTimestamp("<2026-05-10 Sun>")).toEqual({
			startISO: "2026-05-10",
			endISO: "2026-05-10",
			allDay: true,
		});
	});

	it("parses a single time and defaults to a 60-minute duration", () => {
		expect(parseOrgTimestamp("<2026-05-10 Sun 14:00>")).toEqual({
			startISO: "2026-05-10 14:00",
			endISO: "2026-05-10 15:00",
			allDay: false,
		});
	});

	it("parses a time range", () => {
		expect(parseOrgTimestamp("<2026-05-10 Sun 10:00-14:00>")).toEqual({
			startISO: "2026-05-10 10:00",
			endISO: "2026-05-10 14:00",
			allDay: false,
		});
	});

	it("parses a multi-day all-day span", () => {
		expect(parseOrgTimestamp("<2026-05-10>--<2026-05-12>")).toEqual({
			startISO: "2026-05-10",
			endISO: "2026-05-12",
			allDay: true,
		});
	});

	it("parses a timed multi-day span", () => {
		expect(
			parseOrgTimestamp("<2026-05-10 Sun 09:00>--<2026-05-12 Tue 17:00>"),
		).toEqual({
			startISO: "2026-05-10 09:00",
			endISO: "2026-05-12 17:00",
			allDay: false,
		});
	});

	it("parses a mixed timed/all-day multi-day span by promoting to timed", () => {
		const parsed = parseOrgTimestamp("<2026-05-10 09:00>--<2026-05-12>");
		expect(parsed?.allDay).toBe(false);
		expect(parsed?.startISO).toBe("2026-05-10 09:00");
		expect(parsed?.endISO).toBe("2026-05-12 23:59");
	});

	it("falls back to all-day for a malformed-but-date-containing input", () => {
		expect(parseOrgTimestamp("<2026-05-10 bogusxx>")).toEqual({
			startISO: "2026-05-10",
			endISO: "2026-05-10",
			allDay: true,
		});
	});

	it("returns null for unparseable input", () => {
		expect(parseOrgTimestamp("garbage")).toBeNull();
		expect(parseOrgTimestamp("")).toBeNull();
		expect(parseOrgTimestamp(null)).toBeNull();
		expect(parseOrgTimestamp(undefined)).toBeNull();
	});

	it("rolls over an hour when the default duration crosses HH:60", () => {
		expect(parseOrgTimestamp("<2026-05-10 23:30>")).toEqual({
			startISO: "2026-05-10 23:30",
			endISO: "2026-05-11 00:30",
			allDay: false,
		});
	});
});

describe("viewBlocksToScheduleXEvents", () => {
	it("skips blocks with neither scheduled nor deadline", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a"),
			block("b", { scheduled: "<2026-05-10>" }),
		]);
		expect(events.map((e) => e.id)).toEqual(["b"]);
	});

	it("strips leading stars and the TODO state from the title", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a", {
				headlineRaw: "*** TODO buy milk",
				scheduled: "<2026-05-10>",
			}),
		]);
		expect(events[0]?.title).toBe("buy milk");
	});

	it("strips many leading stars without touching trailing TODO-like text", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a", {
				headlineRaw: "***** review TODO list",
				scheduled: "<2026-05-10>",
			}),
		]);
		expect(events[0]?.title).toBe("review TODO list");
	});

	it("emits a timed event when DEADLINE-only carries a time range", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a", { deadline: "<2026-05-12 10:00-11:00>" }),
		]);
		expect(events).toHaveLength(1);
		expect(events[0]?.calendarId).toBe("deadline");
		expect(events[0]?.start).toBe("2026-05-12 10:00");
		expect(events[0]?.end).toBe("2026-05-12 11:00");
	});

	it("uses SCHEDULED over DEADLINE when both exist", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a", {
				scheduled: "<2026-05-10 10:00-11:00>",
				deadline: "<2026-05-12>",
			}),
		]);
		expect(events).toHaveLength(1);
		expect(events[0]?.start).toBe("2026-05-10 10:00");
		expect(events[0]?.calendarId).toBeUndefined();
	});

	it("emits a synthetic deadline event when only DEADLINE is set", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a", { deadline: "<2026-05-12>" }),
		]);
		expect(events).toHaveLength(1);
		expect(events[0]?.calendarId).toBe("deadline");
		expect(events[0]?.start).toBe("2026-05-12");
		expect(events[0]?.end).toBe("2026-05-12");
	});

	it("carries the source ViewBlock on `_block` for click recovery", () => {
		const b = block("a", { scheduled: "<2026-05-10>" });
		const events = viewBlocksToScheduleXEvents([b]);
		expect(events[0]?._block).toBe(b);
	});

	it("pins multi-day span endpoints", () => {
		const events = viewBlocksToScheduleXEvents([
			block("a", { scheduled: "<2026-05-10>--<2026-05-12>" }),
		]);
		expect(events[0]?.start).toBe("2026-05-10");
		expect(events[0]?.end).toBe("2026-05-12");
	});
});
