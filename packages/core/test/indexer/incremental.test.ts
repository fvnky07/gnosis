import { createDrizzleBlockStore, createInMemoryDb } from "@gnosis/db";
import { describe, expect, it } from "vitest";
import { Indexer } from "../../src/indexer/indexer";
import { MemoryVault } from "../../src/vault/memory";

function setup() {
	const vault = new MemoryVault();
	const store = createDrizzleBlockStore(createInMemoryDb());
	const indexer = new Indexer(vault, store);
	return { vault, store, indexer };
}

describe("Indexer.incremental", () => {
	it("re-indexes a single file without touching others", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("a.org", "* a-one\n");
		vault.setFile("b.org", "* b-one\n");

		await indexer.cold();
		const aIdsBefore = await store.listBlockIdsByFile("a.org");
		const bIdsBefore = await store.listBlockIdsByFile("b.org");
		expect(aIdsBefore).toHaveLength(1);
		expect(bIdsBefore).toHaveLength(1);

		// User edits a.org: rewrite with one MORE block
		const aText = await vault.read("a.org");
		await vault.write("a.org", `${aText}* a-two\n`);
		const result = await indexer.incremental("a.org");

		expect(result.filesParsed).toBe(1);
		expect(result.blocksUpserted).toBe(2);
		expect(result.idsMinted).toBe(1); // the new heading

		expect(await store.listBlockIdsByFile("a.org")).toHaveLength(2);
		expect(await store.listBlockIdsByFile("b.org")).toEqual(bIdsBefore);
	});

	it("reports deletions when blocks vanish", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("a.org", "* one\n* two\n* three\n");
		await indexer.cold();
		expect(await store.listBlockIdsByFile("a.org")).toHaveLength(3);

		// Edit: drop the last two headings
		const text = await vault.read("a.org");
		const trimmed = text.split("* two\n")[0];
		await vault.write("a.org", trimmed);
		const result = await indexer.incremental("a.org");

		expect(result.blocksUpserted).toBe(1);
		expect(result.blocksDeleted).toBe(2);
		expect(await store.listBlockIdsByFile("a.org")).toHaveLength(1);
	});

	it("preserves IDs across edits that keep the heading", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("a.org", "* original title\nbody\n");
		await indexer.cold();
		const [{ id: stableId }] = await store.getAllBlocks();

		// Rewrite: change body, keep heading + ID
		const text = await vault.read("a.org");
		await vault.write("a.org", text.replace("body\n", "edited body\n"));
		await indexer.incremental("a.org");

		const all = await store.getAllBlocks();
		expect(all).toHaveLength(1);
		expect(all[0].id).toBe(stableId);
		expect(all[0].body).toBe("edited body\n");
	});

	it("does not mint on subsequent re-indexes", async () => {
		const { vault, indexer } = setup();
		vault.setFile("a.org", "* one\n* two\n");
		const first = await indexer.cold();
		expect(first.idsMinted).toBe(2);

		const second = await indexer.incremental("a.org");
		expect(second.idsMinted).toBe(0);
	});
});

describe("Indexer.remove", () => {
	it("drops all blocks for the path", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("a.org", "* one\n* two\n");
		await indexer.cold();
		expect(await store.listBlockIdsByFile("a.org")).toHaveLength(2);

		await indexer.remove("a.org");
		expect(await store.listBlockIdsByFile("a.org")).toEqual([]);
	});

	it("leaves other files alone", async () => {
		const { vault, store, indexer } = setup();
		vault.setFile("a.org", "* one\n");
		vault.setFile("b.org", "* two\n");
		await indexer.cold();
		await indexer.remove("a.org");
		expect(await store.listBlockIdsByFile("b.org")).toHaveLength(1);
	});
});
