import { describe, expect, it } from "vitest";
import { createDrizzleBlockStore, createInMemoryDb } from "../src/client";
import type { NewBlock } from "../src/schema";

function makeRow(overrides: Partial<NewBlock>): NewBlock {
	return {
		id: "01HXTEST00000000000000",
		filePath: "test.org",
		parentId: null,
		level: 1,
		headlineRaw: "* test",
		todoState: null,
		priority: null,
		scheduled: null,
		deadline: null,
		closed: null,
		body: "",
		startByte: 0,
		endByte: 6,
		...overrides,
	};
}

describe("createDrizzleBlockStore", () => {
	it("upserts and reads blocks for a file", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("a.org", [
			makeRow({ id: "01HXA001", filePath: "a.org" }),
			makeRow({ id: "01HXA002", filePath: "a.org", level: 2 }),
		]);

		const ids = await store.listBlockIdsByFile("a.org");
		expect(ids.sort()).toEqual(["01HXA001", "01HXA002"]);
		expect(await store.getAllBlocks()).toHaveLength(2);
	});

	it("replaces all blocks for a file on upsert", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("a.org", [
			makeRow({ id: "01HXA001", filePath: "a.org" }),
			makeRow({ id: "01HXA002", filePath: "a.org" }),
		]);
		await store.upsertFileBlocks("a.org", [
			makeRow({ id: "01HXA003", filePath: "a.org" }),
		]);

		const ids = await store.listBlockIdsByFile("a.org");
		expect(ids).toEqual(["01HXA003"]);
	});

	it("isolates blocks by file path", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("a.org", [
			makeRow({ id: "01HXA001", filePath: "a.org" }),
		]);
		await store.upsertFileBlocks("b.org", [
			makeRow({ id: "01HXB001", filePath: "b.org" }),
		]);

		expect(await store.listBlockIdsByFile("a.org")).toEqual(["01HXA001"]);
		expect(await store.listBlockIdsByFile("b.org")).toEqual(["01HXB001"]);
	});

	it("deleteBlocksByFile removes only that file's rows", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("a.org", [
			makeRow({ id: "01HXA001", filePath: "a.org" }),
		]);
		await store.upsertFileBlocks("b.org", [
			makeRow({ id: "01HXB001", filePath: "b.org" }),
		]);
		await store.deleteBlocksByFile("a.org");

		expect(await store.listBlockIdsByFile("a.org")).toEqual([]);
		expect(await store.listBlockIdsByFile("b.org")).toEqual(["01HXB001"]);
	});

	it("upsertFileBlocks with empty array deletes all blocks for the file", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("a.org", [
			makeRow({ id: "01HXA001", filePath: "a.org" }),
		]);
		await store.upsertFileBlocks("a.org", []);

		expect(await store.listBlockIdsByFile("a.org")).toEqual([]);
	});
});
