import { describe, expect, it } from "vitest";
import { mintIds } from "../../src/parser/mint-ids";
import { parse } from "../../src/parser/parse";

describe("mintIds", () => {
	it("does nothing when every heading already has an :ID:", () => {
		const text = `* one
:PROPERTIES:
:ID:       01J9AAA
:END:
body
* two
:PROPERTIES:
:ID:       01J9BBB
:END:
`;
		const result = mintIds(text);
		expect(result.mintedCount).toBe(0);
		expect(result.newText).toBe(text);
	});

	it("creates a :PROPERTIES: drawer with :ID: for a heading without one", () => {
		const text = "* one\nbody\n";
		const result = mintIds(text);
		expect(result.mintedCount).toBe(1);
		expect(result.newText).toMatch(
			/^\* one\n:PROPERTIES:\n:ID: {7}[0-9A-Z]{26}\n:END:\nbody\n$/,
		);
	});

	it("inserts :ID: into an existing drawer that lacks one", () => {
		const text = `* one
:PROPERTIES:
:CREATED:  [2026-05-06 Wed 10:13]
:END:
body
`;
		const result = mintIds(text);
		expect(result.mintedCount).toBe(1);
		// CREATED line preserved, :ID: inserted
		expect(result.newText).toMatch(
			/:PROPERTIES:\n:ID: {7}[0-9A-Z]{26}\n:CREATED:/,
		);
		expect(result.newText).toContain(":CREATED:  [2026-05-06 Wed 10:13]");
	});

	it("mints IDs across multiple headings without disturbing existing ones", () => {
		const text = `* a
:PROPERTIES:
:ID:       01J9KEEP
:END:
* b
body
* c
:PROPERTIES:
:CREATED:  [2026-05-06 Wed]
:END:
`;
		const result = mintIds(text);
		expect(result.mintedCount).toBe(2);
		// existing ID preserved
		expect(result.newText).toContain(":ID:       01J9KEEP");
		// b got a fresh drawer
		expect(result.newText).toMatch(
			/\* b\n:PROPERTIES:\n:ID: {7}[0-9A-Z]{26}\n:END:\nbody/,
		);
	});

	it("returned blocks all have IDs after mintIds + reparse", () => {
		const text = "* a\n* b\n* c\n";
		const result = mintIds(text);
		expect(result.mintedCount).toBe(3);
		const parsed = parse(result.newText, "/x.org");
		for (const block of parsed.document.blocks) {
			expect(block.id).toMatch(/^[0-9A-Z]{26}$/);
		}
	});
});
