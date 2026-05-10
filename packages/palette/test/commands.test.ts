import { describe, expect, it } from "vitest";
import { CommandRegistry } from "../src/commands";
import type { PaletteCtx } from "../src/types";

const CTX: PaletteCtx = {
	vaultRoot: null,
	activeFilePath: null,
	selectedBlockId: null,
	exec: {
		captureJournal: async () => {},
		captureTask: async () => {},
		captureNote: async () => {},
		openView: async () => {},
		runCommand: async () => {},
		listFiles: async () => [],
		searchBlocks: async () => [],
		listOutline: async () => [],
		listTabs: async () => [],
		openFile: async () => {},
		openBlock: async () => {},
	},
};

describe("CommandRegistry", () => {
	it("registers and retrieves a command", () => {
		const reg = new CommandRegistry();
		reg.register({ id: "x", label: "Test", run: () => {} });
		expect(reg.get("x")?.label).toBe("Test");
	});

	it("empty query returns every visible command", () => {
		const reg = new CommandRegistry();
		reg.register({ id: "a", label: "First", run: () => {} });
		reg.register({ id: "b", label: "Second", run: () => {} });
		const out = reg.match("", CTX);
		expect(out.map(({ command }) => command.id).sort()).toEqual(["a", "b"]);
	});

	it("filters out commands hidden by shouldShow", () => {
		const reg = new CommandRegistry();
		reg.register({ id: "a", label: "A", run: () => {} });
		reg.register({
			id: "b",
			label: "B",
			run: () => {},
			shouldShow: () => false,
		});
		const out = reg.match("", CTX);
		expect(out.map(({ command }) => command.id)).toEqual(["a"]);
	});

	it("scores exact label matches highest", () => {
		const reg = new CommandRegistry();
		reg.register({ id: "a", label: "Mark as DONE", run: () => {} });
		reg.register({ id: "b", label: "Mark as DONE later", run: () => {} });
		const out = reg.match("mark as done", CTX);
		expect(out[0].command.id).toBe("a");
		expect(out[0].score).toBeGreaterThan(out[1].score);
	});

	it("matches via aliases", () => {
		const reg = new CommandRegistry();
		reg.register({
			id: "a",
			label: "Mark as DONE",
			aliases: ["finish", "complete", "archive"],
			run: () => {},
		});
		const out = reg.match("finish", CTX);
		expect(out).toHaveLength(1);
		expect(out[0].command.id).toBe("a");
	});

	it("ranks label matches above alias matches", () => {
		const reg = new CommandRegistry();
		reg.register({
			id: "viaAlias",
			label: "Unrelated label text",
			aliases: ["target"],
			run: () => {},
		});
		reg.register({
			id: "viaLabel",
			label: "target the heading",
			run: () => {},
		});
		const out = reg.match("target", CTX);
		expect(out[0].command.id).toBe("viaLabel");
	});

	it("returns empty for queries that match nothing", () => {
		const reg = new CommandRegistry();
		reg.register({ id: "a", label: "Mark as DONE", run: () => {} });
		expect(reg.match("xyzzy", CTX)).toEqual([]);
	});
});
