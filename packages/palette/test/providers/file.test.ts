import { describe, expect, it, vi } from "vitest";
import { fileProvider } from "../../src/providers/file";
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

describe("fileProvider", () => {
	it("matches `f` and `f ...`", () => {
		const ctx = makeCtx();
		expect(fileProvider.match("f a", ctx)).toBe(true);
		expect(fileProvider.match("f", ctx)).toBe(true);
		expect(fileProvider.match("foo", ctx)).toBe(false);
	});

	it("returns items for each hit from listFiles", async () => {
		const ctx = makeCtx({
			listFiles: vi.fn(async () => [
				{ path: "a.org", title: "a" },
				{ path: "b.org", title: "b" },
			]),
		});
		const items = await fileProvider.results(
			"f a",
			new AbortController().signal,
			ctx,
		);
		expect(items).toHaveLength(2);
		expect(items[0].id).toMatch(/^file:/);
		expect(items[1].id).toMatch(/^file:/);
		expect(items[0].id).toBe("file:a.org");
		expect(items[1].id).toBe("file:b.org");
	});

	it("item label is the file title and detail is the path", async () => {
		const ctx = makeCtx({
			listFiles: vi.fn(async () => [{ path: "notes/foo.org", title: "Foo" }]),
		});
		const items = await fileProvider.results(
			"f foo",
			new AbortController().signal,
			ctx,
		);
		expect(items[0].label).toBe("Foo");
		expect(items[0].detail).toBe("notes/foo.org");
	});

	it("strips prefix before passing query to listFiles", async () => {
		const listFiles = vi.fn(async () => []);
		const ctx = makeCtx({ listFiles });
		await fileProvider.results(
			"f search term",
			new AbortController().signal,
			ctx,
		);
		expect(listFiles).toHaveBeenCalledWith("search term");
	});

	it("onSubmit calls openFile with the item path", async () => {
		const openFile = vi.fn(async () => {});
		const ctx = makeCtx({
			listFiles: vi.fn(async () => [{ path: "a.org", title: "a" }]),
			openFile,
		});
		const items = await fileProvider.results(
			"f a",
			new AbortController().signal,
			ctx,
		);
		await fileProvider.onSubmit(items[0], ctx);
		expect(openFile).toHaveBeenCalledWith("a.org");
	});
});
