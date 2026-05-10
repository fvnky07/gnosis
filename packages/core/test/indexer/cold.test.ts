import { createDrizzleBlockStore, createInMemoryDb } from "@gnosis/db";
import { describe, expect, it } from "vitest";
import { Indexer } from "../../src/indexer/indexer";
import { MemoryVault } from "../../src/vault/memory";

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function setup() {
	const vault = new MemoryVault();
	const store = createDrizzleBlockStore(createInMemoryDb());
	const indexer = new Indexer(vault, store);
	return { vault, store, indexer };
}

describe("Indexer.cold", () => {
	it("returns zero counts on an empty vault", async () => {
		const { indexer } = setup();
		const result = await indexer.cold();
		expect(result).toMatchObject({
			filesParsed: 0,
			blocksUpserted: 0,
			blocksDeleted: 0,
			idsMinted: 0,
		});
	});

	it("indexes a single-file vault and mints IDs as a side effect", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("daily/2026-05-07.org", "* TODO buy milk\nbody\n");

		const result = await indexer.cold();
		expect(result.filesParsed).toBe(1);
		expect(result.blocksUpserted).toBe(1);
		expect(result.idsMinted).toBe(1);

		const stored = await store.getAllBlocks();
		expect(stored).toHaveLength(1);
		expect(stored[0].id).toMatch(ULID_RE);
		expect(stored[0].filePath).toBe("daily/2026-05-07.org");
		expect(stored[0].todoState).toBe("TODO");
		expect(stored[0].headlineRaw).toBe("* TODO buy milk");

		// The file was rewritten with the :PROPERTIES: drawer
		const rewritten = await vault.read("daily/2026-05-07.org");
		expect(rewritten).toContain(":PROPERTIES:");
		expect(rewritten).toContain(":ID:");
	});

	it("indexes multiple files independently", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("a.org", "* one\n* two\n");
		vault.setFile("b.org", "* three\n");

		const result = await indexer.cold();
		expect(result.filesParsed).toBe(2);
		expect(result.blocksUpserted).toBe(3);
		expect(result.idsMinted).toBe(3);

		expect(await store.listBlockIdsByFile("a.org")).toHaveLength(2);
		expect(await store.listBlockIdsByFile("b.org")).toHaveLength(1);
	});

	it("preserves pre-existing IDs without re-minting", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile(
			"keep.org",
			`* TODO already minted
:PROPERTIES:
:ID:       01J9KEEPONE
:END:
body
`,
		);

		const result = await indexer.cold();
		expect(result.idsMinted).toBe(0);
		expect(result.blocksUpserted).toBe(1);

		const stored = await store.getAllBlocks();
		expect(stored[0].id).toBe("01J9KEEPONE");
		// File is byte-identical to input
		const rewritten = await vault.read("keep.org");
		expect(rewritten).toBe(
			`* TODO already minted
:PROPERTIES:
:ID:       01J9KEEPONE
:END:
body
`,
		);
	});

	it("computes parent_id by ancestor walk", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("nested.org", "* a\n** b\n*** c\n** d\n");

		await indexer.cold();
		const all = await store.getAllBlocks();
		const byHeadline = new Map(all.map((b) => [b.headlineRaw, b]));
		const a = byHeadline.get("* a");
		const b = byHeadline.get("** b");
		const c = byHeadline.get("*** c");
		const d = byHeadline.get("** d");
		expect(a?.parentId).toBeNull();
		expect(b?.parentId).toBe(a?.id);
		expect(c?.parentId).toBe(b?.id);
		expect(d?.parentId).toBe(a?.id);
	});

	it("collects warnings from each file", async () => {
		const { vault, indexer } = setup();
		vault.setFile("bad.org", "* h\n:PROPERTIES:\n:ID: 01J9\n");
		const result = await indexer.cold();
		expect(
			result.warnings.some((w) => w.code === "unterminated-properties-drawer"),
		).toBe(true);
	});
});
