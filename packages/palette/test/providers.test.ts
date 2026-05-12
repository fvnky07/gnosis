import { describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../src/commands";
import { captureProvider } from "../src/providers/capture";
import { createCommandsProvider } from "../src/providers/commands";
import { helpProvider } from "../src/providers/help";
import { recentFilesProvider } from "../src/providers/recent";
import { viewProvider } from "../src/providers/view";
import type { PaletteCtx } from "../src/types";

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

describe("helpProvider", () => {
	it("matches `?` queries", () => {
		expect(helpProvider.match("?", makeCtx())).toBe(true);
		expect(helpProvider.match("foo", makeCtx())).toBe(false);
	});
	it("returns a single help card", async () => {
		const items = await helpProvider.results(
			"?",
			new AbortController().signal,
			makeCtx(),
		);
		expect(items).toHaveLength(1);
		expect(items[0].label).toMatch(/quick reference/i);
	});
});

describe("captureProvider", () => {
	it("matches j/t/n followed by a space", () => {
		const ctx = makeCtx();
		expect(captureProvider.match("j hello", ctx)).toBe(true);
		expect(captureProvider.match("t buy milk", ctx)).toBe(true);
		expect(captureProvider.match("n note text", ctx)).toBe(true);
		expect(captureProvider.match("j", ctx)).toBe(false);
		expect(captureProvider.match("foo", ctx)).toBe(false);
	});
	it("creates a journal item for `j ...`", async () => {
		const items = await captureProvider.results(
			"j thoughts on the parser",
			new AbortController().signal,
			makeCtx(),
		);
		expect(items).toHaveLength(1);
		expect(items[0].label).toBe("Journal: thoughts on the parser");
		expect(items[0].meta?.kind).toBe("journal");
	});
	it("calls captureTask on submit for a task item", async () => {
		const ctx = makeCtx();
		const items = await captureProvider.results(
			"t buy milk",
			new AbortController().signal,
			ctx,
		);
		await captureProvider.onSubmit(items[0], ctx);
		expect(ctx.exec.captureTask).toHaveBeenCalledWith("buy milk");
	});
	it("calls captureJournal on submit for a journal item", async () => {
		const ctx = makeCtx();
		const items = await captureProvider.results(
			"j hello",
			new AbortController().signal,
			ctx,
		);
		await captureProvider.onSubmit(items[0], ctx);
		expect(ctx.exec.captureJournal).toHaveBeenCalledWith("hello");
	});
	it("calls captureNote on submit for a note item", async () => {
		const ctx = makeCtx();
		const items = await captureProvider.results(
			"n freeform",
			new AbortController().signal,
			ctx,
		);
		await captureProvider.onSubmit(items[0], ctx);
		expect(ctx.exec.captureNote).toHaveBeenCalledWith("freeform");
	});
	it("returns no items for an empty body", async () => {
		const items = await captureProvider.results(
			"j ",
			new AbortController().signal,
			makeCtx(),
		);
		expect(items).toEqual([]);
	});
});

describe("viewProvider", () => {
	it("matches `v` and `v ...`", () => {
		const ctx = makeCtx();
		expect(viewProvider.match("v", ctx)).toBe(true);
		expect(viewProvider.match("v journal", ctx)).toBe(true);
		expect(viewProvider.match("vault", ctx)).toBe(false);
	});
	it("returns every view on empty body", async () => {
		const items = await viewProvider.results(
			"v ",
			new AbortController().signal,
			makeCtx(),
		);
		expect(items.map((i) => i.meta?.viewId).sort()).toEqual([
			"agenda-day",
			"agenda-month",
			"agenda-week",
			"journal",
			"todos",
		]);
	});
	it("filters by view name", async () => {
		const items = await viewProvider.results(
			"v jou",
			new AbortController().signal,
			makeCtx(),
		);
		expect(items).toHaveLength(1);
		expect(items[0].meta?.viewId).toBe("journal");
	});
	it("calls openView with the chosen id on submit", async () => {
		const ctx = makeCtx();
		const items = await viewProvider.results(
			"v agenda-day",
			new AbortController().signal,
			ctx,
		);
		await viewProvider.onSubmit(items[0], ctx);
		expect(ctx.exec.openView).toHaveBeenCalledWith("agenda-day");
	});
});

describe("createCommandsProvider", () => {
	it("delegates filtering to the supplied CommandRegistry", async () => {
		const reg = new CommandRegistry();
		reg.register({
			id: "open.settings",
			label: "Open Settings",
			run: () => {},
		});
		reg.register({
			id: "block.markDone",
			label: "Mark current block as DONE",
			aliases: ["finish"],
			run: () => {},
		});
		const provider = createCommandsProvider(reg);
		const ctx = makeCtx();
		const items = await provider.results(
			"> finish",
			new AbortController().signal,
			ctx,
		);
		expect(items).toHaveLength(1);
		expect(items[0].meta?.commandId).toBe("block.markDone");
	});
	it("submit calls runCommand with the matching command id", async () => {
		const reg = new CommandRegistry();
		reg.register({ id: "x", label: "Run", run: () => {} });
		const provider = createCommandsProvider(reg);
		const ctx = makeCtx();
		const items = await provider.results(
			">",
			new AbortController().signal,
			ctx,
		);
		await provider.onSubmit(items[0], ctx);
		expect(ctx.exec.runCommand).toHaveBeenCalledWith("x");
	});
});

describe("recentFilesProvider", () => {
	it("matches an empty query and returns nothing in MVP", async () => {
		const ctx = makeCtx();
		expect(recentFilesProvider.match("", ctx)).toBe(true);
		expect(recentFilesProvider.match("anything", ctx)).toBe(false);
		expect(
			await recentFilesProvider.results("", new AbortController().signal, ctx),
		).toEqual([]);
	});
});
