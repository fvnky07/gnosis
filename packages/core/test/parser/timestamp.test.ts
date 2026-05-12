import { describe, expect, it } from "vitest";
import {
	buildOrgTimestamp,
	formatOrgTimestamp,
	parseOrgTimestamp,
} from "../../src/parser/timestamp";

describe("parseOrgTimestamp", () => {
	it("parses active with date+day+time", () => {
		expect(parseOrgTimestamp("<2026-05-07 Thu 09:00>")).toEqual({
			raw: "<2026-05-07 Thu 09:00>",
			active: true,
			date: "2026-05-07",
			time: "09:00",
		});
	});

	it("parses active date-only", () => {
		expect(parseOrgTimestamp("<2026-05-08 Fri>")).toEqual({
			raw: "<2026-05-08 Fri>",
			active: true,
			date: "2026-05-08",
		});
	});

	it("parses inactive timestamps", () => {
		expect(parseOrgTimestamp("[2026-05-07 Thu 10:00]")).toEqual({
			raw: "[2026-05-07 Thu 10:00]",
			active: false,
			date: "2026-05-07",
			time: "10:00",
		});
	});

	it("parses without day name", () => {
		expect(parseOrgTimestamp("<2026-05-07>")).toMatchObject({
			active: true,
			date: "2026-05-07",
		});
	});

	it("rejects mismatched delimiters", () => {
		expect(parseOrgTimestamp("<2026-05-07]")).toBeNull();
		expect(parseOrgTimestamp("[2026-05-07>")).toBeNull();
	});

	it("rejects malformed input", () => {
		expect(parseOrgTimestamp("not a timestamp")).toBeNull();
		expect(parseOrgTimestamp("<bad>")).toBeNull();
		expect(parseOrgTimestamp("<26-5-7>")).toBeNull();
	});
});

describe("formatOrgTimestamp", () => {
	it("formats active timestamp with explicit time", () => {
		const d = new Date(2026, 4, 7, 9, 0); // May 7, 2026 09:00 local
		expect(formatOrgTimestamp(d, { active: true, includeTime: true })).toMatch(
			/^<2026-05-07 [A-Za-z]{3} 09:00>$/,
		);
	});

	it("formats inactive timestamp without time", () => {
		const d = new Date(2026, 4, 7, 0, 0);
		expect(
			formatOrgTimestamp(d, { active: false, includeTime: false }),
		).toMatch(/^\[2026-05-07 [A-Za-z]{3}\]$/);
	});

	it("auto-includes time when non-midnight", () => {
		const d = new Date(2026, 4, 7, 14, 30);
		expect(formatOrgTimestamp(d, { active: true })).toContain("14:30");
	});

	it("auto-omits time at midnight", () => {
		const d = new Date(2026, 4, 7, 0, 0);
		expect(formatOrgTimestamp(d, { active: true })).not.toContain(":");
	});

	it("emits a single-day range when endTime is supplied", () => {
		const d = new Date(2026, 4, 12, 10, 30);
		expect(
			formatOrgTimestamp(d, {
				active: true,
				includeTime: true,
				endTime: "12:30",
			}),
		).toMatch(/^<2026-05-12 [A-Za-z]{3} 10:30-12:30>$/);
	});

	it("ignores endTime when includeTime resolves to false", () => {
		const d = new Date(2026, 4, 12, 0, 0);
		expect(
			formatOrgTimestamp(d, {
				active: true,
				includeTime: false,
				endTime: "12:30",
			}),
		).toMatch(/^<2026-05-12 [A-Za-z]{3}>$/);
	});
});

describe("parseOrgTimestamp (range form)", () => {
	it("parses a single-day time range", () => {
		expect(parseOrgTimestamp("<2026-05-12 Tue 10:30-12:30>")).toEqual({
			raw: "<2026-05-12 Tue 10:30-12:30>",
			active: true,
			date: "2026-05-12",
			time: "10:30",
			endTime: "12:30",
		});
	});

	it("round-trips range form via formatOrgTimestamp + parseOrgTimestamp", () => {
		const d = new Date(2026, 4, 12, 9, 0);
		const raw = formatOrgTimestamp(d, {
			active: true,
			includeTime: true,
			endTime: "10:00",
		});
		const parsed = parseOrgTimestamp(raw);
		expect(parsed?.time).toBe("09:00");
		expect(parsed?.endTime).toBe("10:00");
	});
});

describe("buildOrgTimestamp", () => {
	it("emits a date-only active timestamp by default", () => {
		expect(buildOrgTimestamp(new Date(2026, 4, 15))).toEqual({
			raw: "<2026-05-15 Fri>",
			active: true,
			date: "2026-05-15",
		});
	});

	it("emits a timed timestamp when withTime is true", () => {
		expect(
			buildOrgTimestamp(new Date(2026, 4, 15, 15, 30), { withTime: true }),
		).toMatchObject({
			raw: "<2026-05-15 Fri 15:30>",
			time: "15:30",
		});
	});

	it("emits a range timestamp when endTime is supplied alongside withTime", () => {
		expect(
			buildOrgTimestamp(new Date(2026, 4, 12, 10, 30), {
				withTime: true,
				endTime: "12:30",
			}),
		).toMatchObject({
			raw: "<2026-05-12 Tue 10:30-12:30>",
			time: "10:30",
			endTime: "12:30",
		});
	});

	it("drops endTime when withTime is false", () => {
		const ts = buildOrgTimestamp(new Date(2026, 4, 15), {
			withTime: false,
			endTime: "12:30",
		});
		expect(ts.raw).toBe("<2026-05-15 Fri>");
		expect(ts.endTime).toBeUndefined();
	});

	it("emits inactive form when active is false", () => {
		expect(
			buildOrgTimestamp(new Date(2026, 4, 11, 9, 24), {
				withTime: true,
				active: false,
			}).raw,
		).toBe("[2026-05-11 Mon 09:24]");
	});
});
