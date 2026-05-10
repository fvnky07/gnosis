import { describe, expect, it } from "vitest";
import type { CmLike } from "../src/motions";
import { nextHeading, sameLevel } from "../src/motions";

function makeCm(lines: string[]): CmLike {
	return {
		getLine: (n: number) => lines[n] ?? "",
		lineCount: () => lines.length,
	};
}

describe("nextHeading", () => {
	const lines = [
		"body text",
		"* Heading 1",
		"some content",
		"** Heading 1.1",
		"more content",
		"* Heading 2",
	];
	const cm = makeCm(lines);

	it("moves forward to the next heading", () => {
		const result = nextHeading(cm, { line: 0, ch: 0 }, +1);
		expect(result).toEqual({ line: 1, ch: 0 });
	});

	it("skips non-heading lines going forward", () => {
		const result = nextHeading(cm, { line: 1, ch: 0 }, +1);
		expect(result).toEqual({ line: 3, ch: 0 });
	});

	it("moves backward to the previous heading", () => {
		const result = nextHeading(cm, { line: 5, ch: 0 }, -1);
		expect(result).toEqual({ line: 3, ch: 0 });
	});

	it("stays put when no heading found going backward", () => {
		const cm2 = makeCm(["no headings here", "just text"]);
		const result = nextHeading(cm2, { line: 1, ch: 3 }, -1);
		expect(result).toEqual({ line: 1, ch: 3 });
	});

	it("stays put when no heading found going forward", () => {
		const cm2 = makeCm(["no headings here", "just text"]);
		const result = nextHeading(cm2, { line: 0, ch: 2 }, +1);
		expect(result).toEqual({ line: 0, ch: 2 });
	});
});

describe("sameLevel", () => {
	const lines = [
		"* H1 first",
		"** H2 first",
		"*** H3",
		"** H2 second",
		"* H1 second",
		"** H2 third",
	];
	const cm = makeCm(lines);

	it("moves to next heading at the same level", () => {
		const result = sameLevel(cm, { line: 1, ch: 0 }, +1);
		expect(result).toEqual({ line: 3, ch: 0 });
	});

	it("moves to prev heading at the same level", () => {
		const result = sameLevel(cm, { line: 3, ch: 0 }, -1);
		expect(result).toEqual({ line: 1, ch: 0 });
	});

	it("stops at a parent heading (lower level) going forward", () => {
		// From H2 at line 3, going forward hits H1 at line 4 (lower level → stop)
		const result = sameLevel(cm, { line: 3, ch: 0 }, +1);
		// Skips line 4 (H1 < H2 level) — should stay put
		expect(result).toEqual({ line: 3, ch: 0 });
	});

	it("falls back to nextHeading when current line is not a heading", () => {
		const cm2 = makeCm(["body", "* Heading", "more body"]);
		// Not on a heading — falls back to nextHeading forward
		const result = sameLevel(cm2, { line: 0, ch: 0 }, +1);
		expect(result).toEqual({ line: 1, ch: 0 });
	});

	it("finds same-level H1 going backward", () => {
		const result = sameLevel(cm, { line: 4, ch: 0 }, -1);
		expect(result).toEqual({ line: 0, ch: 0 });
	});
});
