import { useEffect } from "react";
import {
	type AppearanceSettings,
	type EditorSettings,
	type LayoutSettings,
	type PaletteSettings,
	useSettings,
} from "./settings-store";

/**
 * Side-effect layer that bridges the persisted settings store and the live
 * DOM. Every appearance / layout / editor visual that needs to react to a
 * settings change is mapped to a CSS custom property here; React components
 * then consume those properties from `:root` via Tailwind's `var(--foo)`
 * arbitrary-value syntax (`p-[var(--outer-gap)]`) or inline style.
 *
 * Centralising the side-effect makes the wiring tractable: each new
 * configurable token gets one line in `writeCssVars`, one fallback in
 * `globals.css`, and one consumer at the JSX site. No setting reaches DOM
 * outside this module.
 */

const MOTION_ATTR = "data-motion";

interface CssVar {
	name: string;
	value: string;
}

function writeCssVars(vars: CssVar[]): void {
	const root = document.documentElement;
	for (const v of vars) root.style.setProperty(v.name, v.value);
}

function appearanceVars(a: AppearanceSettings): CssVar[] {
	return [
		{ name: "--accent-color", value: a.accentColor },
		{ name: "--ring", value: a.accentColor },
		{ name: "--ui-font-scale", value: `${a.uiFontScale}` },
		{ name: "--radius", value: `${a.radiusPx / 16}rem` },
		{ name: "--card-border-width", value: a.cardBorderVisible ? "1px" : "0px" },
		{ name: "--window-opacity", value: `${a.windowOpacity}` },
		{ name: "--density-row-padding", value: densityRowPadding(a.density) },
	];
}

function densityRowPadding(d: AppearanceSettings["density"]): string {
	switch (d) {
		case "compact":
			return "0.25rem";
		case "spacious":
			return "0.75rem";
		default:
			return "0.5rem";
	}
}

function layoutVars(l: LayoutSettings): CssVar[] {
	return [
		{ name: "--outer-gap", value: `${l.outerGapPx}px` },
		{ name: "--inner-gap", value: `${l.innerGapPx}px` },
		{ name: "--page-max-width", value: `${l.pageMaxWidthPx}px` },
		{ name: "--note-width-pct", value: `${l.noteWidthPct}%` },
		{ name: "--editor-padding-x", value: `${l.editorPaddingX}px` },
		{ name: "--editor-padding-y", value: `${l.editorPaddingY}px` },
		{ name: "--view-sidebar-width", value: `${l.viewSidebarWidthPx}px` },
	];
}

function editorVars(e: EditorSettings): CssVar[] {
	return [
		{ name: "--editor-font-family", value: editorFontStack(e.fontFamily) },
		{ name: "--editor-font-size", value: `${e.fontSize}px` },
		{ name: "--editor-line-height", value: `${e.lineHeight}` },
		{ name: "--editor-letter-spacing", value: `${e.letterSpacingPx}px` },
		{
			name: "--editor-font-feature",
			value: e.fontLigatures ? "normal" : '"liga" 0, "calt" 0',
		},
		{ name: "--editor-cursor-width", value: `${e.cursorWidthPx}px` },
	];
}

function editorFontStack(family: string): string {
	const fallback = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;
	if (!family.trim()) return fallback;
	if (family.includes(",")) return family;
	const quoted =
		family.includes(" ") && !family.includes('"') ? `"${family}"` : family;
	return `${quoted}, ${fallback}`;
}

function paletteVars(p: PaletteSettings): CssVar[] {
	return [
		{ name: "--palette-top-offset", value: `${p.topOffsetVh}vh` },
		{ name: "--palette-width", value: `${p.widthPx}px` },
	];
}

function applyThemeClass(mode: AppearanceSettings["themeMode"]): void {
	const root = document.documentElement;
	root.classList.remove("light", "dark");
	if (mode === "light") root.classList.add("light");
	else if (mode === "dark") root.classList.add("dark");
	// `system` leaves both classes off; `prefers-color-scheme` handles it.
}

function applyMotion(a: AppearanceSettings): void {
	const root = document.documentElement;
	const reducedByOs =
		a.respectReducedMotion &&
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	const enabled = a.motionEnabled && !reducedByOs;
	if (enabled) root.removeAttribute(MOTION_ATTR);
	else root.setAttribute(MOTION_ATTR, "off");
}

function applyUiFontScale(a: AppearanceSettings): void {
	const root = document.documentElement;
	// Default html font-size is 16px. Multiply by scale so `rem`-based UI scales
	// proportionally without affecting the editor (which uses --editor-font-size).
	root.style.fontSize = `${Math.round(16 * a.uiFontScale)}px`;
}

/**
 * One-shot apply: writes every settings-derived CSS variable + html class +
 * data attribute to the document. Safe to call repeatedly; the store hook
 * below calls it on every relevant state change.
 */
export function applySettings(): void {
	const s = useSettings.getState();
	writeCssVars([
		...appearanceVars(s.appearance),
		...layoutVars(s.layout),
		...editorVars(s.editor),
		...paletteVars(s.interface.palette),
	]);
	applyThemeClass(s.appearance.themeMode);
	applyMotion(s.appearance);
	applyUiFontScale(s.appearance);
}

/**
 * React hook that wires the store to the DOM. Mount once at the top of the
 * shell. The hook:
 *   - applies settings on mount and on every store change.
 *   - listens to `prefers-color-scheme` so `themeMode === "system"` honors
 *     live OS appearance flips.
 *   - listens to `prefers-reduced-motion` so the motion gate stays accurate
 *     when the OS preference changes mid-session.
 */
export function useApplySettings(): void {
	useEffect(() => {
		applySettings();
		const unsubscribe = useSettings.subscribe(() => applySettings());
		const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
		const motionPref = window.matchMedia?.("(prefers-reduced-motion: reduce)");
		const onChange = () => applySettings();
		colorScheme?.addEventListener?.("change", onChange);
		motionPref?.addEventListener?.("change", onChange);
		return () => {
			unsubscribe();
			colorScheme?.removeEventListener?.("change", onChange);
			motionPref?.removeEventListener?.("change", onChange);
		};
	}, []);
}
