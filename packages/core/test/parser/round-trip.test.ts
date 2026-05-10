import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mintIds } from "../../src/parser/mint-ids";
import { parse } from "../../src/parser/parse";

const FIXTURES_DIR = join(__dirname, "..", "fixtures");
const ULID_RE = /[0-9A-HJKMNP-TV-Z]{26}/g;
const ULID_PLACEHOLDER = "ULID00000000000000000000ZZ";

function readFixture(name: string): string {
	return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

function listFixtures(): string[] {
	return readdirSync(FIXTURES_DIR).filter((name) => name.endsWith(".org"));
}

describe("round-trip — parse preserves raw text", () => {
	for (const name of listFixtures()) {
		it(`${name}: parse(text).document.raw === text`, () => {
			const text = readFixture(name);
			const result = parse(text, `/${name}`);
			expect(result.document.raw).toBe(text);
		});
	}
});

describe("round-trip — mintIds is byte-stable for fixtures with pre-existing IDs", () => {
	const fixturesWithAllIds = ["with-id.org", "non-ascii.org"];
	for (const name of fixturesWithAllIds) {
		it(`${name}: mintIds is a no-op`, () => {
			const text = readFixture(name);
			const result = mintIds(text);
			expect(result.mintedCount).toBe(0);
			expect(result.newText).toBe(text);
		});
	}
});

describe("round-trip — mintIds is idempotent across two passes", () => {
	for (const name of listFixtures()) {
		it(`${name}: second mintIds run mints zero`, () => {
			const text = readFixture(name);
			const first = mintIds(text);
			const second = mintIds(first.newText);
			expect(second.mintedCount).toBe(0);
			expect(second.newText).toBe(first.newText);
		});
	}
});

describe("round-trip — mintIds output structure for fixtures missing IDs", () => {
	it("simple.org gets all headings stamped", () => {
		const text = readFixture("simple.org");
		const result = mintIds(text);
		// simple.org has 3 headings, none with :ID: pre-stamping
		expect(result.mintedCount).toBe(3);
		const reparsed = parse(result.newText, "/simple.org");
		for (const block of reparsed.document.blocks) {
			expect(block.id).toMatch(ULID_RE);
		}
	});

	it("nested.org gets every heading stamped, tag inheritance preserved", () => {
		const text = readFixture("nested.org");
		const result = mintIds(text);
		expect(result.mintedCount).toBe(6);
		const reparsed = parse(result.newText, "/nested.org");
		const byTitle = new Map(reparsed.document.blocks.map((b) => [b.title, b]));
		expect(byTitle.get("a")?.tags.sort()).toEqual(["a"]);
		expect(byTitle.get("b")?.tags.sort()).toEqual(["a", "b"]);
		expect(byTitle.get("c")?.tags.sort()).toEqual(["a", "b", "c"]);
		expect(byTitle.get("sibling")?.tags.sort()).toEqual(["a", "sib"]);
		expect(byTitle.get("outer-sibling")?.tags.sort()).toEqual(["other"]);
	});
});

describe("round-trip — empty file is handled cleanly", () => {
	it("parse on empty.org returns no blocks and empty preamble", () => {
		const text = readFixture("empty.org");
		const result = parse(text, "/empty.org");
		expect(result.document.blocks).toEqual([]);
		expect(result.document.preamble).toBe(text);
	});
	it("mintIds on empty.org is a no-op", () => {
		const text = readFixture("empty.org");
		const result = mintIds(text);
		expect(result.mintedCount).toBe(0);
		expect(result.newText).toBe(text);
	});
});

describe("round-trip — large synthetic note (length stress)", () => {
	it("a 200KB org file parses and mints without losing bytes", () => {
		const blocks: string[] = ["#+TITLE: Synthetic large doc\n\n"];
		for (let i = 0; i < 1000; i++) {
			blocks.push(`* heading ${i} :tag${i % 7}:\n`);
			blocks.push(`body for ${i} ${"x".repeat(150)}\n\n`);
		}
		const text = blocks.join("");
		expect(text.length).toBeGreaterThan(150_000);
		const parsed = parse(text, "/big.org");
		expect(parsed.document.blocks).toHaveLength(1000);
		expect(parsed.document.raw).toBe(text);
		const minted = mintIds(text);
		expect(minted.mintedCount).toBe(1000);
		const reparsed = parse(minted.newText, "/big.org");
		expect(reparsed.document.blocks).toHaveLength(1000);
		// Headings preserved
		for (let i = 0; i < 1000; i++) {
			expect(reparsed.document.blocks[i].title).toBe(`heading ${i}`);
		}
	});
});

describe("round-trip — ULID placeholder substitution sanity", () => {
	it("replacing ULIDs gives byte-stable output across runs", () => {
		const text = readFixture("simple.org");
		const a = mintIds(text).newText.replace(ULID_RE, ULID_PLACEHOLDER);
		const b = mintIds(text).newText.replace(ULID_RE, ULID_PLACEHOLDER);
		expect(a).toBe(b);
	});
});
