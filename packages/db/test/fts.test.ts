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

describe("searchBlocks FTS5", () => {
	it("returns results matching the query", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("notes.org", [
			makeRow({
				id: "01HXFTS001",
				filePath: "notes.org",
				headlineRaw: "foo bar baz",
				body: "some content about foo",
			}),
			makeRow({
				id: "01HXFTS002",
				filePath: "notes.org",
				headlineRaw: "unrelated heading",
				body: "nothing here",
			}),
			makeRow({
				id: "01HXFTS003",
				filePath: "notes.org",
				headlineRaw: "another foo mention",
				body: "foo appears again",
			}),
		]);

		const results = await store.searchBlocks("foo");

		expect(results.length).toBeGreaterThan(0);
	});

	it("snippet contains <mark> markers", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("notes.org", [
			makeRow({
				id: "01HXFTS001",
				filePath: "notes.org",
				headlineRaw: "foo bar baz",
				body: "some content about foo",
			}),
			makeRow({
				id: "01HXFTS002",
				filePath: "notes.org",
				headlineRaw: "unrelated heading",
				body: "nothing here",
			}),
			makeRow({
				id: "01HXFTS003",
				filePath: "notes.org",
				headlineRaw: "another foo mention",
				body: "foo appears again",
			}),
		]);

		const results = await store.searchBlocks("foo");

		expect(results.every((r) => r.snippet.includes("<mark>"))).toBe(true);
	});

	it("rank is a number (BM25 returns negative values)", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("notes.org", [
			makeRow({
				id: "01HXFTS001",
				filePath: "notes.org",
				headlineRaw: "foo bar baz",
				body: "some content about foo",
			}),
			makeRow({
				id: "01HXFTS002",
				filePath: "notes.org",
				headlineRaw: "unrelated heading",
				body: "nothing here",
			}),
			makeRow({
				id: "01HXFTS003",
				filePath: "notes.org",
				headlineRaw: "another foo mention",
				body: "foo appears again",
			}),
		]);

		const results = await store.searchBlocks("foo");

		expect(results.every((r) => typeof r.rank === "number")).toBe(true);
	});

	it("returns empty array for empty query", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("notes.org", [
			makeRow({
				id: "01HXFTS001",
				filePath: "notes.org",
				headlineRaw: "foo bar baz",
				body: "",
			}),
		]);

		expect(await store.searchBlocks("")).toEqual([]);
		expect(await store.searchBlocks("   ")).toEqual([]);
	});

	it("respects the limit parameter", async () => {
		const db = createInMemoryDb();
		const store = createDrizzleBlockStore(db);

		await store.upsertFileBlocks("notes.org", [
			makeRow({
				id: "01HXFTS001",
				filePath: "notes.org",
				headlineRaw: "foo alpha",
				body: "",
			}),
			makeRow({
				id: "01HXFTS002",
				filePath: "notes.org",
				headlineRaw: "foo beta",
				body: "",
			}),
			makeRow({
				id: "01HXFTS003",
				filePath: "notes.org",
				headlineRaw: "foo gamma",
				body: "",
			}),
		]);

		const results = await store.searchBlocks("foo", 2);

		expect(results.length).toBeLessThanOrEqual(2);
	});
});
