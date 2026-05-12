/**
 * Public types for the gnosis editor. The React surface is `<EditorPane />`
 * and `<BlockSnippet />` — internals (CodeMirror state, dispatched actions)
 * are intentionally not exported.
 */

export type LineNumbersMode = "off" | "absolute" | "relative";
export type WhitespaceRenderMode = "none" | "boundary" | "selection" | "all";
export type CursorStyleOption = "block" | "line" | "underline";

/**
 * Subset of persisted settings consumed by `createEditor` to drive
 * CodeMirror extensions. The desktop shell maps `useSettings().editor` into
 * this shape; the editor package itself does not depend on the store so it
 * can be reused outside the Tauri app.
 */
export interface EditorOptions {
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	letterSpacingPx: number;
	fontLigatures: boolean;
	lineNumbers: LineNumbersMode;
	foldGutter: boolean;
	wordWrap: boolean;
	tabSize: number;
	insertSpaces: boolean;
	highlightActiveLine: boolean;
	matchBrackets: boolean;
	closeBrackets: boolean;
	indentGuides: boolean;
	cursorStyle: CursorStyleOption;
	cursorBlink: boolean;
	cursorWidthPx: number;
	autocomplete: boolean;
	/** Comma-separated rulers (`"80,100"`). Empty disables. */
	rulers: string;
	renderWhitespace: WhitespaceRenderMode;
	/**
	 * Obsidian-style live preview for org buffers: hide heading stars,
	 * emphasis markers (`*`/`/`/`_`/`=`/`~`/`+`), and link punctuation when
	 * the cursor is not on the same line. Heading lines scale up via
	 * `cm-org-hN` classes; emphasis bodies render as bold/italic/code/etc.
	 * Source stays raw org-mode — overlay only.
	 */
	livePreview: boolean;
}

export interface BufferProps {
	bufferId: string;
	/** Full file contents on mount. CodeMirror's EditorState owns the source of truth while mounted. */
	initialDoc: string;
	filePath: string;
	/** Default true — vim is core, not a setting. */
	vimEnabled?: boolean;
	/** Optional editor options. When omitted, `DEFAULT_EDITOR_OPTIONS` apply. */
	editorOpts?: EditorOptions;
	/** Optional vim runtime options. When omitted, `DEFAULT_VIM_OPTIONS` apply. */
	vimOpts?: import("./vim").VimOptions;
	/** Fired after a 250 ms idle window of inactivity. Receives the full buffer text. */
	onChange: (text: string) => void;
	/** Fired after a 1 s idle window. Receives the top-line scroll offset. */
	onScroll?: (top: number) => void;
	/** Optional initial cursor / selection range expressed in source byte offsets. */
	initialSelection?: { from: number; to: number };
	/** Optional host bindings for vim ex commands (`:done`, `:capture`, etc.). */
	vimHostBindings?: import("./vim").VimHostBindings;
	/** Optional callback fired whenever the vim mode changes. */
	onVimModeChange?: (mode: import("./mode-observer").VimMode) => void;
	/** Optional callback fired on cursor/selection move + doc edits with the
	 * current line/col + word counts. */
	onSelectionChange?: (
		info: import("./selection-observer").SelectionInfo,
	) => void;
}

export const DEFAULT_EDITOR_OPTIONS: EditorOptions = {
	fontFamily:
		'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	fontSize: 14,
	lineHeight: 1.55,
	letterSpacingPx: 0,
	fontLigatures: true,
	lineNumbers: "off",
	foldGutter: true,
	wordWrap: true,
	tabSize: 2,
	insertSpaces: true,
	highlightActiveLine: true,
	matchBrackets: true,
	closeBrackets: true,
	indentGuides: true,
	cursorStyle: "line",
	cursorBlink: true,
	cursorWidthPx: 2,
	autocomplete: true,
	rulers: "",
	renderWhitespace: "selection",
	livePreview: false,
};

/** Kind of org-flavored token recognized by {@link findOrgTokens}. */
export type OrgTokenKind =
	| "todo-keyword"
	| "priority"
	| "tag"
	| "timestamp-active"
	| "timestamp-inactive"
	| "drawer-marker"
	| "file-keyword";

/** A single org token's location in source text. */
export interface OrgToken {
	kind: OrgTokenKind;
	start: number;
	end: number;
}

/**
 * Additional token kinds emitted only by {@link findOrgProseTokens} to
 * power live preview. Kept separate from {@link OrgTokenKind} so the
 * always-on `gnosisOrgExtras` highlighter doesn't accidentally render
 * them (it would either need extra branches or duplicate class wiring).
 */
export type OrgProseTokenKind =
	| "heading-mark-1"
	| "heading-mark-2"
	| "heading-mark-3"
	| "heading-mark-4"
	| "heading-mark-5"
	| "heading-mark-6"
	| "emphasis-bold-mark"
	| "emphasis-bold-body"
	| "emphasis-italic-mark"
	| "emphasis-italic-body"
	| "emphasis-underline-mark"
	| "emphasis-underline-body"
	| "emphasis-verbatim-mark"
	| "emphasis-verbatim-body"
	| "emphasis-code-mark"
	| "emphasis-code-body"
	| "emphasis-strike-mark"
	| "emphasis-strike-body"
	| "link-bracket"
	| "link-url"
	| "link-label";

export interface OrgProseToken {
	kind: OrgProseTokenKind;
	start: number;
	end: number;
}
