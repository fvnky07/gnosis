import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Persisted settings for the desktop shell. The store is namespaced by group
 * (`appearance`, `layout`, `interface`, `editor`, `vim`, `org`, `files`,
 * `advanced`) so the Settings dialog can present each pane against a single
 * slice and `applyAppearance` / `EditorPane` can read the slice they need
 * without subscribing to the whole tree.
 *
 * Persisted under `gnosis-settings` (zustand persist middleware). Version is
 * bumped to 2 when the schema changes; the migration drops unknown keys and
 * seeds defaults for new ones so an older user picks up the new options
 * without losing their existing values.
 */

export type ThemeMode = "system" | "light" | "dark";
export type Density = "compact" | "comfortable" | "spacious";
export type LineNumbersMode = "off" | "absolute" | "relative";
export type WhitespaceMode = "none" | "boundary" | "selection" | "all";
export type CursorStyle = "block" | "line" | "underline";
export type PalettePosition = "top" | "center";
export type PaletteBackdrop = "none" | "dim" | "blur";
export type AutoSaveMode = "off" | "afterDelay" | "onBlur";
export type DefaultExt = "org" | "md";
export type StartupFolded = "showall" | "content" | "overview";
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";
export type ViewSidebarSide = "left" | "right";

export interface AppearanceSettings {
	themeMode: ThemeMode;
	accentColor: string;
	density: Density;
	uiFontScale: number;
	radiusPx: number;
	cardBorderVisible: boolean;
	motionEnabled: boolean;
	respectReducedMotion: boolean;
	windowOpacity: number;
}

export interface LayoutSettings {
	outerGapPx: number;
	innerGapPx: number;
	pageMaxWidthPx: number;
	noteWidthPct: number;
	centerContent: boolean;
	editorPaddingX: number;
	editorPaddingY: number;
	viewSidebarWidthPx: number;
	viewSidebarPosition: ViewSidebarSide;
}

export interface TopBarSettings {
	visible: boolean;
	showMode: boolean;
	showFilePath: boolean;
	showLineCol: boolean;
	showWordCount: boolean;
	showCharCount: boolean;
	showReadingTime: boolean;
	showVimRegister: boolean;
	showClock: boolean;
	showTabCount: boolean;
}

export interface TabsSettings {
	enabled: boolean;
	showModifiedDot: boolean;
	middleClickClose: boolean;
}

export interface PaletteSettings {
	position: PalettePosition;
	topOffsetVh: number;
	widthPx: number;
	backdrop: PaletteBackdrop;
	resultLimit: number;
	preserveQueryOnReopen: boolean;
}

export interface InterfaceSettings {
	topBar: TopBarSettings;
	tabs: TabsSettings;
	palette: PaletteSettings;
	breadcrumbsEnabled: boolean;
}

export interface EditorSettings {
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	letterSpacingPx: number;
	fontLigatures: boolean;
	lineNumbers: LineNumbersMode;
	foldGutter: boolean;
	wordWrap: boolean;
	wrapColumn: number;
	tabSize: number;
	insertSpaces: boolean;
	trimTrailingWhitespace: boolean;
	rulers: string;
	highlightActiveLine: boolean;
	matchBrackets: boolean;
	closeBrackets: boolean;
	renderWhitespace: WhitespaceMode;
	indentGuides: boolean;
	cursorStyle: CursorStyle;
	cursorBlink: boolean;
	cursorWidthPx: number;
	scrolloff: number;
	autocomplete: boolean;
}

export interface VimSettings {
	enabled: boolean;
	leader: string;
	jkEscape: boolean;
	jkTimeoutMs: number;
	relativeNumbers: boolean;
	smartCase: boolean;
	systemClipboard: boolean;
	startInNormal: boolean;
}

export interface OrgSettings {
	hideStars: boolean;
	hideEmphasisMarkers: boolean;
	inlineImages: boolean;
	startupFolded: StartupFolded;
	todoKeywords: string;
}

export interface FilesSettings {
	autoSave: AutoSaveMode;
	autoSaveDelayMs: number;
	confirmDelete: boolean;
	defaultExtension: DefaultExt;
	journalFolder: string;
	journalDateFormat: string;
	attachmentFolder: string;
}

export interface AdvancedSettings {
	logLevel: LogLevel;
	developerMode: boolean;
	experimental: Record<string, boolean>;
}

export interface SettingsSnapshot {
	appearance: AppearanceSettings;
	layout: LayoutSettings;
	interface: InterfaceSettings;
	editor: EditorSettings;
	vim: VimSettings;
	org: OrgSettings;
	files: FilesSettings;
	advanced: AdvancedSettings;
}

export type SettingsSection = keyof SettingsSnapshot;

export const DEFAULT_SETTINGS: SettingsSnapshot = {
	appearance: {
		themeMode: "system",
		accentColor: "#2563eb",
		density: "comfortable",
		uiFontScale: 1.0,
		radiusPx: 10,
		cardBorderVisible: true,
		motionEnabled: true,
		respectReducedMotion: true,
		windowOpacity: 1.0,
	},
	layout: {
		outerGapPx: 8,
		innerGapPx: 8,
		pageMaxWidthPx: 1100,
		noteWidthPct: 60,
		centerContent: true,
		editorPaddingX: 24,
		editorPaddingY: 24,
		viewSidebarWidthPx: 400,
		viewSidebarPosition: "right",
	},
	interface: {
		topBar: {
			visible: true,
			showMode: true,
			showFilePath: true,
			showLineCol: true,
			showWordCount: true,
			showCharCount: true,
			showReadingTime: false,
			showVimRegister: false,
			showClock: false,
			showTabCount: true,
		},
		tabs: {
			enabled: false,
			showModifiedDot: true,
			middleClickClose: true,
		},
		palette: {
			position: "top",
			topOffsetVh: 14,
			widthPx: 480,
			backdrop: "blur",
			resultLimit: 50,
			preserveQueryOnReopen: false,
		},
		breadcrumbsEnabled: false,
	},
	editor: {
		fontFamily: "Commit Mono",
		fontSize: 14,
		lineHeight: 1.55,
		letterSpacingPx: 0,
		fontLigatures: true,
		lineNumbers: "off",
		foldGutter: true,
		wordWrap: true,
		wrapColumn: 0,
		tabSize: 2,
		insertSpaces: true,
		trimTrailingWhitespace: true,
		rulers: "",
		highlightActiveLine: true,
		matchBrackets: true,
		closeBrackets: true,
		renderWhitespace: "selection",
		indentGuides: true,
		cursorStyle: "line",
		cursorBlink: true,
		cursorWidthPx: 2,
		scrolloff: 8,
		autocomplete: true,
	},
	vim: {
		enabled: true,
		leader: "space",
		jkEscape: true,
		jkTimeoutMs: 200,
		relativeNumbers: true,
		smartCase: true,
		systemClipboard: true,
		startInNormal: true,
	},
	org: {
		hideStars: false,
		hideEmphasisMarkers: false,
		inlineImages: true,
		startupFolded: "showall",
		todoKeywords: "TODO,NEXT,WAIT,DONE,CANCELED",
	},
	files: {
		autoSave: "afterDelay",
		autoSaveDelayMs: 1000,
		confirmDelete: true,
		defaultExtension: "org",
		journalFolder: "journal/",
		journalDateFormat: "YYYY-MM-DD",
		attachmentFolder: "attachments/",
	},
	advanced: {
		logLevel: "info",
		developerMode: false,
		experimental: {},
	},
};

interface SettingsActions {
	updateAppearance(patch: Partial<AppearanceSettings>): void;
	updateLayout(patch: Partial<LayoutSettings>): void;
	updateTopBar(patch: Partial<TopBarSettings>): void;
	updateTabs(patch: Partial<TabsSettings>): void;
	updatePalette(patch: Partial<PaletteSettings>): void;
	updateInterface(
		patch: Partial<Omit<InterfaceSettings, "topBar" | "tabs" | "palette">>,
	): void;
	updateEditor(patch: Partial<EditorSettings>): void;
	updateVim(patch: Partial<VimSettings>): void;
	updateOrg(patch: Partial<OrgSettings>): void;
	updateFiles(patch: Partial<FilesSettings>): void;
	updateAdvanced(patch: Partial<AdvancedSettings>): void;
	toggleVim(): void;
	toggleTopBar(): void;
	toggleTheme(): void;
	resetSection(section: SettingsSection): void;
	resetAll(): void;
	exportJson(): string;
	importJson(payload: string): { ok: boolean; error?: string };
}

export type SettingsState = SettingsSnapshot & SettingsActions;

function clamp(n: number, min: number, max: number): number {
	if (Number.isNaN(n)) return min;
	return Math.min(max, Math.max(min, n));
}

function clampPatch<T extends object>(
	patch: T,
	clamps: Partial<Record<keyof T, [number, number]>>,
): T {
	const out: Record<string, unknown> = { ...patch };
	for (const [key, range] of Object.entries(clamps)) {
		if (!range) continue;
		const raw = out[key];
		if (typeof raw === "number") {
			out[key] = clamp(raw, range[0], range[1]);
		}
	}
	return out as T;
}

const APPEARANCE_CLAMPS: Partial<
	Record<keyof AppearanceSettings, [number, number]>
> = {
	uiFontScale: [0.85, 1.25],
	radiusPx: [0, 24],
	windowOpacity: [0.8, 1.0],
};

const LAYOUT_CLAMPS: Partial<Record<keyof LayoutSettings, [number, number]>> = {
	outerGapPx: [0, 48],
	innerGapPx: [0, 48],
	pageMaxWidthPx: [600, 1600],
	noteWidthPct: [30, 100],
	editorPaddingX: [0, 96],
	editorPaddingY: [0, 96],
	viewSidebarWidthPx: [320, 640],
};

const PALETTE_CLAMPS: Partial<Record<keyof PaletteSettings, [number, number]>> =
	{
		topOffsetVh: [5, 25],
		widthPx: [480, 800],
		resultLimit: [10, 100],
	};

const EDITOR_CLAMPS: Partial<Record<keyof EditorSettings, [number, number]>> = {
	fontSize: [10, 24],
	lineHeight: [1.0, 2.0],
	letterSpacingPx: [-1, 2],
	wrapColumn: [0, 200],
	tabSize: [1, 8],
	cursorWidthPx: [1, 4],
	scrolloff: [0, 20],
};

const VIM_CLAMPS: Partial<Record<keyof VimSettings, [number, number]>> = {
	jkTimeoutMs: [50, 500],
};

const FILES_CLAMPS: Partial<Record<keyof FilesSettings, [number, number]>> = {
	autoSaveDelayMs: [250, 5000],
};

function shallowMerge<T>(base: T, patch: Partial<T>): T {
	return { ...base, ...patch };
}

export const useSettings = create<SettingsState>()(
	persist(
		(set, get) => ({
			...DEFAULT_SETTINGS,

			updateAppearance: (patch) =>
				set((s) => ({
					appearance: shallowMerge(
						s.appearance,
						clampPatch(patch, APPEARANCE_CLAMPS),
					),
				})),
			updateLayout: (patch) =>
				set((s) => ({
					layout: shallowMerge(s.layout, clampPatch(patch, LAYOUT_CLAMPS)),
				})),
			updateTopBar: (patch) =>
				set((s) => ({
					interface: {
						...s.interface,
						topBar: shallowMerge(s.interface.topBar, patch),
					},
				})),
			updateTabs: (patch) =>
				set((s) => ({
					interface: {
						...s.interface,
						tabs: shallowMerge(s.interface.tabs, patch),
					},
				})),
			updatePalette: (patch) =>
				set((s) => ({
					interface: {
						...s.interface,
						palette: shallowMerge(
							s.interface.palette,
							clampPatch(patch, PALETTE_CLAMPS),
						),
					},
				})),
			updateInterface: (patch) =>
				set((s) => ({ interface: shallowMerge(s.interface, patch) })),
			updateEditor: (patch) =>
				set((s) => ({
					editor: shallowMerge(s.editor, clampPatch(patch, EDITOR_CLAMPS)),
				})),
			updateVim: (patch) =>
				set((s) => ({
					vim: shallowMerge(s.vim, clampPatch(patch, VIM_CLAMPS)),
				})),
			updateOrg: (patch) => set((s) => ({ org: shallowMerge(s.org, patch) })),
			updateFiles: (patch) =>
				set((s) => ({
					files: shallowMerge(s.files, clampPatch(patch, FILES_CLAMPS)),
				})),
			updateAdvanced: (patch) =>
				set((s) => ({ advanced: shallowMerge(s.advanced, patch) })),

			toggleVim: () =>
				set((s) => ({ vim: { ...s.vim, enabled: !s.vim.enabled } })),
			toggleTopBar: () =>
				set((s) => ({
					interface: {
						...s.interface,
						topBar: {
							...s.interface.topBar,
							visible: !s.interface.topBar.visible,
						},
					},
				})),
			toggleTheme: () =>
				set((s) => {
					// system → dark → light → system
					const next: ThemeMode =
						s.appearance.themeMode === "system"
							? "dark"
							: s.appearance.themeMode === "dark"
								? "light"
								: "system";
					return { appearance: { ...s.appearance, themeMode: next } };
				}),

			resetSection: (section) =>
				set(
					() =>
						({
							[section]: DEFAULT_SETTINGS[section],
						}) as Partial<SettingsState>,
				),
			resetAll: () => set(() => ({ ...DEFAULT_SETTINGS })),

			exportJson: () => {
				const snapshot = pickSnapshot(get());
				return JSON.stringify(snapshot, null, 2);
			},
			importJson: (payload) => {
				try {
					const parsed = JSON.parse(payload) as Partial<SettingsSnapshot>;
					const merged = mergeSnapshot(DEFAULT_SETTINGS, parsed);
					set(() => merged);
					return { ok: true };
				} catch (err) {
					return {
						ok: false,
						error: err instanceof Error ? err.message : String(err),
					};
				}
			},
		}),
		{
			name: "gnosis-settings",
			version: 2,
			migrate: (persistedState, fromVersion) => {
				// v1 carried { noteWidthPct, statusBarVisible, vimEnabled } at the root.
				// statusBarVisible maps to the new topBar.visible since the status row
				// has been refactored into a top bar.
				// Lift those into the v2 namespaces and seed everything else from defaults.
				if (fromVersion < 2) {
					const v1 = (persistedState ?? {}) as {
						noteWidthPct?: number;
						statusBarVisible?: boolean;
						vimEnabled?: boolean;
					};
					return {
						...DEFAULT_SETTINGS,
						layout: {
							...DEFAULT_SETTINGS.layout,
							noteWidthPct: clamp(
								v1.noteWidthPct ?? DEFAULT_SETTINGS.layout.noteWidthPct,
								30,
								100,
							),
						},
						interface: {
							...DEFAULT_SETTINGS.interface,
							topBar: {
								...DEFAULT_SETTINGS.interface.topBar,
								visible:
									v1.statusBarVisible ??
									DEFAULT_SETTINGS.interface.topBar.visible,
							},
						},
						vim: {
							...DEFAULT_SETTINGS.vim,
							enabled: v1.vimEnabled ?? DEFAULT_SETTINGS.vim.enabled,
						},
					};
				}
				return persistedState as SettingsSnapshot;
			},
			partialize: (state) => pickSnapshot(state),
			merge: (persisted, current) => {
				// Persisted state may be missing keys from a newer schema. Merge per
				// namespace so additions land with defaults instead of `undefined`.
				const base = current as SettingsState;
				if (!persisted || typeof persisted !== "object") return base;
				const merged = mergeSnapshot(
					DEFAULT_SETTINGS,
					persisted as Partial<SettingsSnapshot>,
				);
				return { ...base, ...merged };
			},
		},
	),
);

function pickSnapshot(state: SettingsSnapshot): SettingsSnapshot {
	return {
		appearance: state.appearance,
		layout: state.layout,
		interface: state.interface,
		editor: state.editor,
		vim: state.vim,
		org: state.org,
		files: state.files,
		advanced: state.advanced,
	};
}

function mergeSnapshot(
	base: SettingsSnapshot,
	patch: Partial<SettingsSnapshot>,
): SettingsSnapshot {
	return {
		appearance: { ...base.appearance, ...(patch.appearance ?? {}) },
		layout: { ...base.layout, ...(patch.layout ?? {}) },
		interface: {
			...base.interface,
			...(patch.interface ?? {}),
			topBar: {
				...base.interface.topBar,
				...(patch.interface?.topBar ?? {}),
			},
			tabs: { ...base.interface.tabs, ...(patch.interface?.tabs ?? {}) },
			palette: {
				...base.interface.palette,
				...(patch.interface?.palette ?? {}),
			},
		},
		editor: { ...base.editor, ...(patch.editor ?? {}) },
		vim: { ...base.vim, ...(patch.vim ?? {}) },
		org: { ...base.org, ...(patch.org ?? {}) },
		files: { ...base.files, ...(patch.files ?? {}) },
		advanced: { ...base.advanced, ...(patch.advanced ?? {}) },
	};
}

/** Public helper for tests + import: produce a fresh default snapshot. */
export function defaultSettings(): SettingsSnapshot {
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
