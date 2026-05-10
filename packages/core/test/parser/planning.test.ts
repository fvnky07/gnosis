import { describe, expect, it } from "vitest";
import { parsePlanningLine } from "../../src/parser/planning";

describe("parsePlanningLine", () => {
	it("parses scheduled only", () => {
		const text = "SCHEDULED: <2026-05-07 Thu 09:00>\nbody\n";
		const result = parsePlanningLine(text);
		expect(result.scheduled?.date).toBe("2026-05-07");
		expect(result.scheduled?.time).toBe("09:00");
		expect(result.deadline).toBeUndefined();
		expect(result.lineStart).toBe(0);
	});

	it("parses deadline only", () => {
		const text = "DEADLINE: <2026-05-08 Fri>\n";
		const result = parsePlanningLine(text);
		expect(result.deadline?.date).toBe("2026-05-08");
		expect(result.scheduled).toBeUndefined();
	});

	it("parses both scheduled and deadline on same line", () => {
		const text = "SCHEDULED: <2026-05-07 Thu> DEADLINE: <2026-05-08 Fri>\n";
		const result = parsePlanningLine(text);
		expect(result.scheduled?.date).toBe("2026-05-07");
		expect(result.deadline?.date).toBe("2026-05-08");
	});

	it("returns absent when first line is not planning", () => {
		const text = "regular body\nSCHEDULED: <2026-05-07 Thu>\n";
		const result = parsePlanningLine(text);
		expect(result.lineStart).toBe(-1);
	});

	it("ignores CLOSED token in MVP but still parses companions", () => {
		const text = "CLOSED: [2026-05-07 Thu 12:00] SCHEDULED: <2026-05-08 Fri>\n";
		const result = parsePlanningLine(text);
		expect(result.scheduled?.date).toBe("2026-05-08");
		expect(result.deadline).toBeUndefined();
	});

	it("skips leading blank lines", () => {
		const text = "\n\nSCHEDULED: <2026-05-07 Thu>\n";
		const result = parsePlanningLine(text);
		expect(result.scheduled?.date).toBe("2026-05-07");
		expect(result.lineStart).toBe(2);
	});

	it("returns absent for empty input", () => {
		expect(parsePlanningLine("")).toEqual({ lineStart: -1, lineEnd: -1 });
	});
});
