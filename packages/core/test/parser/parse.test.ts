import { describe, expect, it } from "vitest";
import { parse } from "../../src/parser/parse";

describe("parse", () => {
	it("parses an empty document", () => {
		const result = parse("", "/test.org");
		expect(result.document.blocks).toEqual([]);
		expect(result.document.preamble).toBe("");
		expect(result.document.fileTags).toEqual([]);
		expect(result.document.title).toBeUndefined();
	});

	it("parses preamble #+TITLE and #+FILETAGS", () => {
		const text = "#+TITLE: Hello\n#+FILETAGS: :a:b:\n\n";
		const result = parse(text, "/x.org");
		expect(result.document.title).toBe("Hello");
		expect(result.document.fileTags).toEqual(["a", "b"]);
		expect(result.document.preamble).toBe(text);
	});

	it("parses a simple heading", () => {
		const text = "* TODO buy milk\n";
		const result = parse(text, "/x.org");
		expect(result.document.blocks).toHaveLength(1);
		const block = result.document.blocks[0];
		expect(block.title).toBe("buy milk");
		expect(block.todo).toBe("TODO");
		expect(block.level).toBe(1);
		expect(block.id).toBe("");
	});

	it("parses properties drawer + planning + body", () => {
		const text = `* TODO ship it
:PROPERTIES:
:ID:       01J9
:END:
SCHEDULED: <2026-05-07 Thu 09:00>
body line one
body line two
`;
		const result = parse(text, "/x.org");
		expect(result.document.blocks).toHaveLength(1);
		const block = result.document.blocks[0];
		expect(block.id).toBe("01J9");
		expect(block.scheduled?.date).toBe("2026-05-07");
		expect(block.scheduled?.time).toBe("09:00");
		expect(block.body).toBe("body line one\nbody line two\n");
		expect(block.properties.ID).toBe("01J9");
	});

	it("inherits tags from ancestors and file", () => {
		const text = `#+FILETAGS: :file:
* parent :work:
** child :urgent:
`;
		const result = parse(text, "/x.org");
		const [parent, child] = result.document.blocks;
		expect(parent.tags.sort()).toEqual(["file", "work"]);
		expect(child.tags.sort()).toEqual(["file", "urgent", "work"]);
	});

	it("does not inherit from sibling subtrees", () => {
		const text = `* sibling-a :a:
** child-of-a
* sibling-b :b:
** child-of-b
`;
		const result = parse(text, "/x.org");
		const [, childOfA, , childOfB] = result.document.blocks;
		expect(childOfA.tags.sort()).toEqual(["a"]);
		expect(childOfB.tags.sort()).toEqual(["b"]);
	});

	it("computes byte ranges accurately", () => {
		const text = "* one\n* two\n";
		const result = parse(text, "/x.org");
		const [a, b] = result.document.blocks;
		expect(a.rangeInFile).toEqual({ start: 0, end: 6 });
		expect(b.rangeInFile).toEqual({ start: 6, end: 12 });
	});

	it("preserves preamble raw", () => {
		const text = "comment\n#+TITLE: T\n* h\n";
		const result = parse(text, "/x.org");
		expect(result.document.preamble).toBe("comment\n#+TITLE: T\n");
	});

	it("preserves the full raw text", () => {
		const text = "* h\n:PROPERTIES:\n:ID: 01J9\n:END:\nbody\n";
		const result = parse(text, "/x.org");
		expect(result.document.raw).toBe(text);
	});

	it("collects warnings from properties drawer", () => {
		const text = "* h\n:PROPERTIES:\n:ID: 01J9\n";
		const result = parse(text, "/x.org");
		expect(
			result.warnings.some((w) => w.code === "unterminated-properties-drawer"),
		).toBe(true);
	});

	it("warning ranges are absolute file offsets, not section-relative", () => {
		// Preamble pushes the heading down; the unterminated-drawer warning
		// must reference the absolute file position, not the section body.
		const preamble = "#+TITLE: example\n\n";
		const text = `${preamble}* h\n:PROPERTIES:\n:ID: 01J9\n`;
		const result = parse(text, "/x.org");
		const warning = result.warnings.find(
			(w) => w.code === "unterminated-properties-drawer",
		);
		expect(warning?.range?.start).toBeGreaterThan(preamble.length);
		// The reported start should land inside the actual `:PROPERTIES:` line
		// in the source, not at byte 0.
		const drawerIdx = text.indexOf(":PROPERTIES:");
		expect(warning?.range?.start).toBe(drawerIdx);
	});

	it("treats body without drawer/planning as raw body", () => {
		const text = "* h\nfirst\nsecond\n";
		const result = parse(text, "/x.org");
		expect(result.document.blocks[0].body).toBe("first\nsecond\n");
	});

	it("handles deep nesting", () => {
		const text = "* a :a:\n** b :b:\n*** c :c:\n";
		const result = parse(text, "/x.org");
		const [a, b, c] = result.document.blocks;
		expect(a.tags.sort()).toEqual(["a"]);
		expect(b.tags.sort()).toEqual(["a", "b"]);
		expect(c.tags.sort()).toEqual(["a", "b", "c"]);
	});

	it("ignores non-heading * lines (no space after stars)", () => {
		const text = "* real heading\n*not a heading\nbody\n";
		const result = parse(text, "/x.org");
		expect(result.document.blocks).toHaveLength(1);
		expect(result.document.blocks[0].body).toBe("*not a heading\nbody\n");
	});
});
