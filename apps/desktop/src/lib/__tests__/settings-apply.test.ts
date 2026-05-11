/**
 * Apply-layer tests. Run with:
 *   cd apps/desktop && bun test src/lib/__tests__/settings-apply.test.ts
 *
 * The apply layer mutates `document.documentElement` (style + class + data
 * attribute). We shim a minimal HTMLElement-like target rather than pulling
 * in jsdom — covers the surfaces this module touches.
 */
import { beforeEach, describe, expect, it } from "bun:test";

interface StyleStore {
	props: Map<string, string>;
	fontSize: string;
}

function installDom() {
	const props = new Map<string, string>();
	const classes = new Set<string>();
	const attrs = new Map<string, string>();
	const style: StyleStore = { props, fontSize: "" };
	const documentElement = {
		style: new Proxy(style, {
			get(target, key: string) {
				if (key === "setProperty") {
					return (name: string, value: string) => {
						target.props.set(name, value);
					};
				}
				if (key === "removeProperty") {
					return (name: string) => {
						target.props.delete(name);
					};
				}
				if (key === "fontSize") return target.fontSize;
				return undefined;
			},
			set(target, key: string, value: string) {
				if (key === "fontSize") {
					target.fontSize = value;
					return true;
				}
				return false;
			},
		}),
		classList: {
			add: (...names: string[]) => {
				for (const n of names) classes.add(n);
			},
			remove: (...names: string[]) => {
				for (const n of names) classes.delete(n);
			},
			toggle: (n: string, force?: boolean) => {
				const has = classes.has(n);
				if (force === undefined) {
					if (has) classes.delete(n);
					else classes.add(n);
				} else if (force) classes.add(n);
				else classes.delete(n);
			},
			contains: (n: string) => classes.has(n),
		},
		setAttribute: (n: string, v: string) => attrs.set(n, v),
		removeAttribute: (n: string) => attrs.delete(n),
		getAttribute: (n: string) => attrs.get(n) ?? null,
	};
	const ls = {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {},
		clear: () => {},
		key: () => null,
		length: 0,
	};
	const matchMedia = () => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	});
	(globalThis as Record<string, unknown>).document = { documentElement };
	(globalThis as Record<string, unknown>).window = {
		localStorage: ls,
		matchMedia,
	};
	(globalThis as Record<string, unknown>).localStorage = ls;
	return { style, classes, attrs };
}

describe("settings-apply", () => {
	let dom: ReturnType<typeof installDom>;

	beforeEach(async () => {
		dom = installDom();
		const { useSettings } = await import("../settings-store");
		useSettings.getState().resetAll();
	});

	it("writes layout CSS vars from store state", async () => {
		const { useSettings } = await import("../settings-store");
		const { applySettings } = await import("../settings-apply");
		useSettings.getState().updateLayout({
			outerGapPx: 16,
			innerGapPx: 12,
			pageMaxWidthPx: 900,
			noteWidthPct: 75,
		});
		applySettings();
		expect(dom.style.props.get("--outer-gap")).toBe("16px");
		expect(dom.style.props.get("--inner-gap")).toBe("12px");
		expect(dom.style.props.get("--page-max-width")).toBe("900px");
		expect(dom.style.props.get("--note-width-pct")).toBe("75%");
	});

	it("writes editor font vars", async () => {
		const { useSettings } = await import("../settings-store");
		const { applySettings } = await import("../settings-apply");
		useSettings.getState().updateEditor({
			fontFamily: "Iosevka",
			fontSize: 16,
			lineHeight: 1.7,
			fontLigatures: false,
		});
		applySettings();
		expect(dom.style.props.get("--editor-font-size")).toBe("16px");
		expect(dom.style.props.get("--editor-line-height")).toBe("1.7");
		expect(dom.style.props.get("--editor-font-family")).toContain("Iosevka");
		expect(dom.style.props.get("--editor-font-feature")).toBe(
			'"liga" 0, "calt" 0',
		);
	});

	it("toggles the dark/light class for themeMode", async () => {
		const { useSettings } = await import("../settings-store");
		const { applySettings } = await import("../settings-apply");
		useSettings.getState().updateAppearance({ themeMode: "dark" });
		applySettings();
		expect(dom.classes.has("dark")).toBe(true);
		expect(dom.classes.has("light")).toBe(false);
		useSettings.getState().updateAppearance({ themeMode: "light" });
		applySettings();
		expect(dom.classes.has("light")).toBe(true);
		expect(dom.classes.has("dark")).toBe(false);
		useSettings.getState().updateAppearance({ themeMode: "system" });
		applySettings();
		expect(dom.classes.has("dark")).toBe(false);
		expect(dom.classes.has("light")).toBe(false);
	});

	it("sets data-motion='off' when motion is disabled", async () => {
		const { useSettings } = await import("../settings-store");
		const { applySettings } = await import("../settings-apply");
		useSettings.getState().updateAppearance({ motionEnabled: false });
		applySettings();
		expect(dom.attrs.get("data-motion")).toBe("off");
		useSettings.getState().updateAppearance({ motionEnabled: true });
		applySettings();
		expect(dom.attrs.get("data-motion")).toBeUndefined();
	});

	it("scales the html font-size from uiFontScale", async () => {
		const { useSettings } = await import("../settings-store");
		const { applySettings } = await import("../settings-apply");
		useSettings.getState().updateAppearance({ uiFontScale: 1.25 });
		applySettings();
		expect(dom.style.fontSize).toBe("20px");
	});

	it("maps accentColor onto --ring", async () => {
		const { useSettings } = await import("../settings-store");
		const { applySettings } = await import("../settings-apply");
		useSettings.getState().updateAppearance({ accentColor: "#ff8800" });
		applySettings();
		expect(dom.style.props.get("--ring")).toBe("#ff8800");
		expect(dom.style.props.get("--accent-color")).toBe("#ff8800");
	});
});
