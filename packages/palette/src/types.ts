import type { ReactNode } from "react";

/**
 * Palette mode hierarchy. The root mode is just the unfiltered palette;
 * sub-modes are reached via prefix triggers (`>` `f ` `b ` etc.) and the
 * mode state machine in `state.ts`.
 *
 * Within the palette UI, INSERT/LIST refer to whether the cursor lives in
 * the filter input or in the list — that orthogonal axis is tracked in
 * `state.ts` separately.
 */
export type PaletteMode =
	| "root"
	| "commands"
	| "fileSearch"
	| "blockSearch"
	| "capture"
	| "view"
	| "templates"
	| "outline"
	| "tabs"
	| "settings"
	| "recentFiles"
	| "help";

/** Context handed to providers on every query / submit. */
export interface PaletteCtx {
	vaultRoot: string | null;
	activeFilePath: string | null;
	selectedBlockId: string | null;
	/**
	 * Executors injected by the host. Tests pass mock implementations; the
	 * desktop runtime wires Tauri-backed implementations.
	 */
	exec: PaletteExecutors;
}

export interface FileHit {
	path: string;
	title: string;
	preview?: string;
}

export interface BlockHit {
	id: string;
	filePath: string;
	headline: string;
	snippet: string;
	rank?: number;
}

export interface OutlineHit {
	id: string;
	filePath: string;
	level: number;
	headline: string;
	line: number;
}

export interface TabHit {
	id: string;
	filePath: string;
	title: string;
	active?: boolean;
}

export interface PaletteExecutors {
	captureJournal(text: string): Promise<void>;
	captureTask(text: string): Promise<void>;
	captureNote(text: string): Promise<void>;
	openView(viewId: "journal" | "agenda" | "todos"): Promise<void>;
	runCommand(commandId: string): Promise<void>;
	listFiles(query: string): Promise<FileHit[]>;
	searchBlocks(query: string): Promise<BlockHit[]>;
	listOutline(filePath: string | null): Promise<OutlineHit[]>;
	listTabs(): Promise<TabHit[]>;
	openFile(path: string): Promise<void>;
	openBlock(blockId: string): Promise<void>;
}

export interface PaletteItem {
	/** Stable across renders so frecency can score it. */
	id: string;
	label: string;
	detail?: string;
	icon?: ReactNode;
	meta?: Record<string, unknown>;
}

export interface ItemAction {
	id: string;
	label: string;
	/** Single-letter shortcut shown on the right of the row. */
	shortcut?: string;
	run(item: PaletteItem, ctx: PaletteCtx): Promise<void>;
}

/**
 * A palette provider. Providers register themselves in `PaletteRegistry`;
 * the engine iterates registered providers per keystroke and merges their
 * results.
 */
export interface PaletteProvider {
	id: string;
	/** Optional prefix that activates this provider (e.g. `'> '`, `'f '`). */
	trigger?: string;
	/** Modes the provider participates in. */
	scope: PaletteMode | PaletteMode[];
	/**
	 * Lower numbers come first in root-mode result merging. Defaults to 100.
	 */
	rank: number;
	/** Cheap pre-filter so providers can opt out fast on every keystroke. */
	match(query: string, ctx: PaletteCtx): boolean;
	/** Compute results for a query. May be async (FTS5, fs.list). */
	results(
		query: string,
		signal: AbortSignal,
		ctx: PaletteCtx,
	): Promise<PaletteItem[]>;
	/** Run when the user hits Enter on an item. */
	onSubmit(item: PaletteItem, ctx: PaletteCtx): Promise<void>;
	/** Optional contextual actions opened by Tab. */
	actions?(item: PaletteItem, ctx: PaletteCtx): ItemAction[];
	/** Optional preview pane content. */
	preview?(item: PaletteItem): ReactNode;
	/** Optional empty state when results are []. */
	empty?: ReactNode;
}
