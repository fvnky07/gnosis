import { describe, expect, it } from "vitest";
import { PaletteRegistry, queryProviders } from "../src/registry";
import type { PaletteCtx, PaletteProvider } from "../src/types";

const NOOP_CTX: PaletteCtx = {
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

function makeProvider(
	overrides: Partial<PaletteProvider> & { id: string },
): PaletteProvider {
	return {
		scope: "root",
		rank: 100,
		match: () => true,
		results: async () => [],
		onSubmit: async () => {},
		...overrides,
	};
}

describe("PaletteRegistry", () => {
	it("registers and retrieves a provider by id", () => {
		const reg = new PaletteRegistry();
		const p = makeProvider({ id: "test" });
		reg.register(p);
		expect(reg.get("test")).toBe(p);
	});

	it("re-registering the same id replaces the previous provider", () => {
		const reg = new PaletteRegistry();
		const original = makeProvider({ id: "test", rank: 100 });
		const replacement = makeProvider({ id: "test", rank: 5 });
		reg.register(original);
		reg.register(replacement);
		expect(reg.get("test")).toBe(replacement);
		expect(reg.all()).toHaveLength(1);
	});

	it("orders providers by rank ascending", () => {
		const reg = new PaletteRegistry();
		reg.register(makeProvider({ id: "a", rank: 50 }));
		reg.register(makeProvider({ id: "b", rank: 5 }));
		reg.register(makeProvider({ id: "c", rank: 100 }));
		expect(reg.all().map((p) => p.id)).toEqual(["b", "a", "c"]);
	});

	it("forMode filters by single-mode and array-mode scopes", () => {
		const reg = new PaletteRegistry();
		reg.register(makeProvider({ id: "root-only", scope: "root" }));
		reg.register(
			makeProvider({ id: "root-and-cmd", scope: ["root", "commands"] }),
		);
		reg.register(makeProvider({ id: "cmd-only", scope: "commands" }));

		expect(
			reg
				.forMode("root")
				.map((p) => p.id)
				.sort(),
		).toEqual(["root-and-cmd", "root-only"]);
		expect(
			reg
				.forMode("commands")
				.map((p) => p.id)
				.sort(),
		).toEqual(["cmd-only", "root-and-cmd"]);
	});

	it("resolveByTrigger returns the longest matching prefix", () => {
		const reg = new PaletteRegistry();
		reg.register(makeProvider({ id: "task", trigger: "t " }));
		reg.register(makeProvider({ id: "template", trigger: "tpl " }));
		expect(reg.resolveByTrigger("tpl daily")?.id).toBe("template");
		expect(reg.resolveByTrigger("t buy milk")?.id).toBe("task");
	});

	it("unregister removes the provider", () => {
		const reg = new PaletteRegistry();
		reg.register(makeProvider({ id: "x" }));
		reg.unregister("x");
		expect(reg.get("x")).toBeUndefined();
		expect(reg.all()).toEqual([]);
	});

	it("queryProviders runs every matching provider in scope", async () => {
		const reg = new PaletteRegistry();
		reg.register(
			makeProvider({
				id: "p1",
				match: () => true,
				results: async () => [{ id: "a", label: "A" }],
			}),
		);
		reg.register(
			makeProvider({
				id: "p2",
				match: () => true,
				results: async () => [{ id: "b", label: "B" }],
			}),
		);
		reg.register(
			makeProvider({
				id: "p3",
				match: () => false,
				results: async () => [{ id: "c", label: "C" }],
			}),
		);
		const out = await queryProviders(
			reg,
			"root",
			"x",
			new AbortController().signal,
			NOOP_CTX,
		);
		expect(out.map((r) => r.provider.id).sort()).toEqual(["p1", "p2"]);
		expect(out.flatMap((r) => r.items.map((i) => i.id)).sort()).toEqual([
			"a",
			"b",
		]);
	});
});
