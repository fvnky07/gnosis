import { describe, expect, it } from "vitest";
import {
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
});
