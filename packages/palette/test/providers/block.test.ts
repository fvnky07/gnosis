import { describe, expect, it, vi } from "vitest";
import { blockProvider } from "../../src/providers/block";
import type { PaletteCtx } from "../../src/types";

function makeCtx(overrides: Partial<PaletteCtx["exec"]> = {}): PaletteCtx {
	return {
		vaultRoot: "/vault",
		activeFilePath: null,
		selectedBlockId: null,
		exec: {
			captureJournal: vi.fn(async () => {}),
			captureTask: vi.fn(async () => {}),
			captureNote: vi.fn(async () => {}),
			openView: vi.fn(async () => {}),
			runCommand: vi.fn(async () => {}),
			listFiles: vi.fn(async () => []),
			searchBlocks: vi.fn(async () => []),
			listOutline: vi.fn(async () => []),
			listTabs: vi.fn(async () => []),
			openFile: vi.fn(async () => {}),
			openBlock: vi.fn(async () => {}),
			...overrides,
		},
	};
}

describe("blockProvider", () => {
	it("matches `b` and `b ...`", () => {
		const ctx = makeCtx();
		expect(blockProvider.match("b search", ctx)).toBe(true);
		expect(blockProvider.match("b", ctx)).toBe(true);
		expect(blockProvider.match("bar", ctx)).toBe(false);
	});

	it("returns items for each hit from searchBlocks", async () => {
		const ctx = makeCtx({
			searchBlocks: vi.fn(async () => [
				{
					id: "block-1",
					filePath: "notes/a.org",
					headline: "First Heading",
					snippet: "some content",
				},
				{
					id: "block-2",
					filePath: "notes/b.org",
					headline: "Second Heading",
					snippet: "other content",
				},
			]),
		});
		const items = await blockProvider.results(
			"b heading",
			new AbortController().signal,
			ctx,
		);
		expect(items).toHaveLength(2);
		expect(items[0].id).toBe("block:block-1");
		expect(items[1].id).toBe("block:block-2");
	});

	it("item label is headline and detail is snippet", async () => {
		const ctx = makeCtx({
			searchBlocks: vi.fn(async () => [
				{
					id: "x",
					filePath: "f.org",
					headline: "My Heading",
					snippet: "the snippet text",
				},
			]),
		});
		const items = await blockProvider.results(
			"b my",
			new AbortController().signal,
			ctx,
		);
		expect(items[0].label).toBe("My Heading");
		expect(items[0].detail).toBe("the snippet text");
	});

	it("strips prefix before passing query to searchBlocks", async () => {
		const searchBlocks = vi.fn(async () => []);
		const ctx = makeCtx({ searchBlocks });
		await blockProvider.results(
			"b search term",
			new AbortController().signal,
			ctx,
		);
		expect(searchBlocks).toHaveBeenCalledWith("search term");
	});

	it("onSubmit calls openBlock with the block id", async () => {
		const openBlock = vi.fn(async () => {});
		const ctx = makeCtx({
			searchBlocks: vi.fn(async () => [
				{
					id: "block-42",
					filePath: "f.org",
					headline: "H",
					snippet: "s",
				},
			]),
			openBlock,
		});
		const items = await blockProvider.results(
			"b h",
			new AbortController().signal,
			ctx,
		);
		await blockProvider.onSubmit(items[0], ctx);
		expect(openBlock).toHaveBeenCalledWith("block-42");
	});
});
