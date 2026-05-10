import { describe, expect, it } from "vitest";
import {
	dayDiff,
	parseOrgDate,
	relativeDate,
	startOfDay,
} from "../../src/lib/relative-date";

const ANCHOR = new Date(2026, 4, 10, 14, 0); // Sunday May 10 2026 14:00

describe("startOfDay", () => {
	it("zeroes the time portion", () => {
		const d = new Date(2026, 4, 10, 14, 30, 45, 100);
		const out = startOfDay(d);
		expect(out.getHours()).toBe(0);
		expect(out.getMinutes()).toBe(0);
		expect(out.getSeconds()).toBe(0);
		expect(out.getMilliseconds()).toBe(0);
	});
});

describe("dayDiff", () => {
	it("returns 0 for the same day", () => {
		expect(
			dayDiff(new Date(2026, 4, 10, 9, 0), new Date(2026, 4, 10, 23, 30)),
		).toBe(0);
	});
	it("returns positive for future dates", () => {
		expect(dayDiff(new Date(2026, 4, 12), new Date(2026, 4, 10))).toBe(2);
	});
	it("returns negative for past dates", () => {
		expect(dayDiff(new Date(2026, 4, 8), new Date(2026, 4, 10))).toBe(-2);
	});
});

describe("relativeDate", () => {
	it("Today", () => {
		expect(relativeDate(ANCHOR, ANCHOR)).toBe("Today");
	});
	it("Tomorrow", () => {
		expect(relativeDate(new Date(2026, 4, 11, 9, 0), ANCHOR)).toBe("Tomorrow");
	});
	it("Yesterday", () => {
		expect(relativeDate(new Date(2026, 4, 9), ANCHOR)).toBe("Yesterday");
	});
	it("uses weekday name within the week (future)", () => {
		expect(relativeDate(new Date(2026, 4, 13), ANCHOR)).toBe("Wednesday");
	});
	it("Overdue Nd within last week (past)", () => {
		expect(relativeDate(new Date(2026, 4, 7), ANCHOR)).toBe("Overdue 3d");
	});
	it("Overdue with month/year suffix beyond a week", () => {
		expect(relativeDate(new Date(2026, 0, 1), ANCHOR)).toMatch(/Overdue/);
	});
	it("in Nd within a month (future)", () => {
		expect(relativeDate(new Date(2026, 4, 25), ANCHOR)).toBe("in 15d");
	});
	it("ISO date for far future", () => {
		expect(relativeDate(new Date(2027, 0, 1), ANCHOR)).toBe("2027-01-01");
	});
});

describe("parseOrgDate", () => {
	it("returns null for null input", () => {
		expect(parseOrgDate(null)).toBeNull();
		expect(parseOrgDate(undefined)).toBeNull();
		expect(parseOrgDate("")).toBeNull();
	});
	it("parses an active timestamp", () => {
		const d = parseOrgDate("<2026-05-07 Thu 09:00>");
		expect(d?.getFullYear()).toBe(2026);
		expect(d?.getMonth()).toBe(4);
		expect(d?.getDate()).toBe(7);
	});
	it("parses an inactive timestamp", () => {
		const d = parseOrgDate("[2026-05-07 Thu]");
		expect(d?.getDate()).toBe(7);
	});
	it("parses a bare date", () => {
		const d = parseOrgDate("2026-05-07");
		expect(d?.getDate()).toBe(7);
	});
});
