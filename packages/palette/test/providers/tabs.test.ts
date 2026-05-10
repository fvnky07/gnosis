import { describe, expect, it, vi } from "vitest";
import { tabsProvider } from "../../src/providers/tabs";
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

describe("tabsProvider", () => {
	it("matches `tabs` and `tabs ...`", () => {
		const ctx = makeCtx();
		expect(tabsProvider.match("tabs", ctx)).toBe(true);
		expect(tabsProvider.match("tabs search", ctx)).toBe(true);
		expect(tabsProvider.match("tab", ctx)).toBe(false);
		expect(tabsProvider.match("other", ctx)).toBe(false);
	});

	it("returns items for each tab from listTabs", async () => {
		const ctx = makeCtx({
			listTabs: vi.fn(async () => [
				{ id: "t1", filePath: "a.org", title: "File A", active: true },
				{ id: "t2", filePath: "b.org", title: "File B" },
			]),
		});
		const items = await tabsProvider.results(
			"tabs",
			new AbortController().signal,
			ctx,
		);
		expect(items).toHaveLength(2);
		expect(items[0].id).toBe("tab:t1");
		expect(items[1].id).toBe("tab:t2");
	});

	it("item label is the tab title and detail is the filePath", async () => {
		const ctx = makeCtx({
			listTabs: vi.fn(async () => [
				{ id: "t1", filePath: "notes/foo.org", title: "Foo Note" },
			]),
		});
		const items = await tabsProvider.results(
			"tabs",
			new AbortController().signal,
			ctx,
		);
		expect(items[0].label).toBe("Foo Note");
		expect(items[0].detail).toBe("notes/foo.org");
	});

	it("filters results by query substring", async () => {
		const ctx = makeCtx({
			listTabs: vi.fn(async () => [
				{ id: "t1", filePath: "a.org", title: "Alpha" },
				{ id: "t2", filePath: "b.org", title: "Beta" },
			]),
		});
		const items = await tabsProvider.results(
			"tabs alp",
			new AbortController().signal,
			ctx,
		);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe("tab:t1");
	});

	it("onSubmit calls openFile with the tab filePath", async () => {
		const openFile = vi.fn(async () => {});
		const ctx = makeCtx({
			listTabs: vi.fn(async () => [
				{ id: "t1", filePath: "notes/bar.org", title: "Bar" },
			]),
			openFile,
		});
		const items = await tabsProvider.results(
			"tabs",
			new AbortController().signal,
			ctx,
		);
		await tabsProvider.onSubmit(items[0], ctx);
		expect(openFile).toHaveBeenCalledWith("notes/bar.org");
	});
});
