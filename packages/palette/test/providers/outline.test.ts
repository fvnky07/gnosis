import { describe, expect, it, vi } from "vitest";
import { outlineProvider } from "../../src/providers/outline";
import type { PaletteCtx } from "../../src/types";

function makeCtx(overrides: Partial<PaletteCtx["exec"]> = {}): PaletteCtx {
	return {
		vaultRoot: "/vault",
		activeFilePath: "notes/active.org",
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

describe("outlineProvider", () => {
	it("matches `o` and `o ...`", () => {
		const ctx = makeCtx();
		expect(outlineProvider.match("o", ctx)).toBe(true);
		expect(outlineProvider.match("o something", ctx)).toBe(true);
		expect(outlineProvider.match("open", ctx)).toBe(false);
	});

	it("calls listOutline with the activeFilePath from ctx", async () => {
		const listOutline = vi.fn(async () => []);
		const ctx = makeCtx({ listOutline });
		ctx.activeFilePath = "notes/active.org";
		await outlineProvider.results("o", new AbortController().signal, ctx);
		expect(listOutline).toHaveBeenCalledWith("notes/active.org");
	});

	it("applies level-based indentation to headline", async () => {
		const ctx = makeCtx({
			listOutline: vi.fn(async () => [
				{ id: "h1", filePath: "f.org", level: 1, headline: "Top", line: 1 },
				{ id: "h2", filePath: "f.org", level: 2, headline: "Sub", line: 5 },
				{
					id: "h3",
					filePath: "f.org",
					level: 3,
					headline: "SubSub",
					line: 10,
				},
			]),
		});
		const items = await outlineProvider.results(
			"o",
			new AbortController().signal,
			ctx,
		);
		expect(items).toHaveLength(3);
		expect(items[0].label).toBe("Top");
		expect(items[1].label).toBe("  Sub");
		expect(items[2].label).toBe("    SubSub");
	});

	it("ids are prefixed with outline:", () => {
		const ctx = makeCtx({
			listOutline: vi.fn(async () => [
				{ id: "abc", filePath: "f.org", level: 1, headline: "H", line: 1 },
			]),
		});
		return outlineProvider
			.results("o", new AbortController().signal, ctx)
			.then((items) => {
				expect(items[0].id).toBe("outline:abc");
			});
	});

	it("onSubmit calls openBlock with the block id", async () => {
		const openBlock = vi.fn(async () => {});
		const ctx = makeCtx({
			listOutline: vi.fn(async () => [
				{ id: "blk-99", filePath: "f.org", level: 2, headline: "H", line: 3 },
			]),
			openBlock,
		});
		const items = await outlineProvider.results(
			"o",
			new AbortController().signal,
			ctx,
		);
		await outlineProvider.onSubmit(items[0], ctx);
		expect(openBlock).toHaveBeenCalledWith("blk-99");
	});
});
