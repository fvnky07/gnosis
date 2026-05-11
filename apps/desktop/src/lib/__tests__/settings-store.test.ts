/**
 * Settings store tests. Run with:
 *   cd apps/desktop && bun test src/lib/__tests__/settings-store.test.ts
 *
 * The store uses `zustand/persist` which writes to `localStorage`; bun's
 * test runtime provides a usable global, but we still reset it between
 * cases so cross-test contamination doesn't masquerade as a bug.
 */
import { beforeEach, describe, expect, it } from "bun:test";

// Shim a minimal localStorage on globalThis before importing the module —
// `zustand/persist` reads `window.localStorage` at construction time.
function installLocalStorage(seed?: Record<string, string>) {
	const store = new Map<string, string>(Object.entries(seed ?? {}));
	const ls = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, String(v));
		},
		removeItem: (k: string) => {
			store.delete(k);
		},
		clear: () => {
			store.clear();
		},
		key: (i: number) => Array.from(store.keys())[i] ?? null,
		get length() {
			return store.size;
		},
	};
	(globalThis as { localStorage?: unknown }).localStorage = ls;
	(globalThis as { window?: unknown }).window = { localStorage: ls };
}

describe("settings-store", () => {
	beforeEach(async () => {
		installLocalStorage();
		// Reset the singleton store between tests so each one starts from
		// defaults regardless of which mutations ran in earlier cases.
		const { useSettings } = await import("../settings-store");
		useSettings.getState().resetAll();
	});

	it("seeds defaults on first construction", async () => {
		const { useSettings, DEFAULT_SETTINGS } = await import("../settings-store");
		const state = useSettings.getState();
		expect(state.appearance.themeMode).toBe(
			DEFAULT_SETTINGS.appearance.themeMode,
		);
		expect(state.layout.outerGapPx).toBe(DEFAULT_SETTINGS.layout.outerGapPx);
		expect(state.editor.fontSize).toBe(DEFAULT_SETTINGS.editor.fontSize);
		expect(state.vim.enabled).toBe(true);
		expect(state.interface.topBar.visible).toBe(true);
	});

	it("clamps appearance.uiFontScale into [0.85, 1.25]", async () => {
		const { useSettings } = await import("../settings-store");
		useSettings.getState().updateAppearance({ uiFontScale: 0.5 });
		expect(useSettings.getState().appearance.uiFontScale).toBe(0.85);
		useSettings.getState().updateAppearance({ uiFontScale: 5 });
		expect(useSettings.getState().appearance.uiFontScale).toBe(1.25);
	});

	it("clamps layout dimensions", async () => {
		const { useSettings } = await import("../settings-store");
		useSettings.getState().updateLayout({
			outerGapPx: 9999,
			pageMaxWidthPx: 100,
			noteWidthPct: 200,
		});
		const s = useSettings.getState().layout;
		expect(s.outerGapPx).toBe(48);
		expect(s.pageMaxWidthPx).toBe(600);
		expect(s.noteWidthPct).toBe(100);
	});

	it("resets one section without disturbing others", async () => {
		const { useSettings, DEFAULT_SETTINGS } = await import("../settings-store");
		useSettings.getState().updateAppearance({ accentColor: "#ff00ff" });
		useSettings.getState().updateLayout({ outerGapPx: 20 });
		useSettings.getState().resetSection("appearance");
		expect(useSettings.getState().appearance.accentColor).toBe(
			DEFAULT_SETTINGS.appearance.accentColor,
		);
		// layout is untouched.
		expect(useSettings.getState().layout.outerGapPx).toBe(20);
	});

	it("resetAll restores every section", async () => {
		const { useSettings, DEFAULT_SETTINGS } = await import("../settings-store");
		useSettings.getState().updateEditor({ fontSize: 22, wordWrap: false });
		useSettings.getState().updateVim({ enabled: false });
		useSettings.getState().resetAll();
		expect(useSettings.getState().editor.fontSize).toBe(
			DEFAULT_SETTINGS.editor.fontSize,
		);
		expect(useSettings.getState().vim.enabled).toBe(
			DEFAULT_SETTINGS.vim.enabled,
		);
	});

	it("toggleVim flips vim.enabled", async () => {
		const { useSettings } = await import("../settings-store");
		const before = useSettings.getState().vim.enabled;
		useSettings.getState().toggleVim();
		expect(useSettings.getState().vim.enabled).toBe(!before);
	});

	it("toggleTheme cycles system → dark → light → system", async () => {
		const { useSettings } = await import("../settings-store");
		useSettings.getState().updateAppearance({ themeMode: "system" });
		useSettings.getState().toggleTheme();
		expect(useSettings.getState().appearance.themeMode).toBe("dark");
		useSettings.getState().toggleTheme();
		expect(useSettings.getState().appearance.themeMode).toBe("light");
		useSettings.getState().toggleTheme();
		expect(useSettings.getState().appearance.themeMode).toBe("system");
	});

	it("export → import round-trips", async () => {
		const { useSettings } = await import("../settings-store");
		useSettings.getState().updateEditor({ fontSize: 19 });
		useSettings.getState().updateAppearance({ accentColor: "#00ff88" });
		const json = useSettings.getState().exportJson();
		useSettings.getState().resetAll();
		expect(useSettings.getState().editor.fontSize).not.toBe(19);
		const result = useSettings.getState().importJson(json);
		expect(result.ok).toBe(true);
		expect(useSettings.getState().editor.fontSize).toBe(19);
		expect(useSettings.getState().appearance.accentColor).toBe("#00ff88");
	});

	it("importJson rejects malformed payloads", async () => {
		const { useSettings } = await import("../settings-store");
		const result = useSettings.getState().importJson("{not valid json");
		expect(result.ok).toBe(false);
		expect(typeof result.error).toBe("string");
	});

	it("import accepts partial snapshots and fills the rest from defaults", async () => {
		const { useSettings, DEFAULT_SETTINGS } = await import("../settings-store");
		useSettings
			.getState()
			.updateEditor({ fontSize: DEFAULT_SETTINGS.editor.fontSize + 4 });
		const partial = JSON.stringify({ appearance: { themeMode: "dark" } });
		const result = useSettings.getState().importJson(partial);
		expect(result.ok).toBe(true);
		expect(useSettings.getState().appearance.themeMode).toBe("dark");
		expect(useSettings.getState().editor.fontSize).toBe(
			DEFAULT_SETTINGS.editor.fontSize,
		);
	});
});
