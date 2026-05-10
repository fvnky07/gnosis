/**
 * Public types for the gnosis editor. The React surface is `<EditorPane />`
 * and `<BlockSnippet />` — internals (CodeMirror state, dispatched actions)
 * are intentionally not exported.
 */

export interface BufferProps {
	bufferId: string;
	/** Full file contents on mount. CodeMirror's EditorState owns the source of truth while mounted. */
	initialDoc: string;
	filePath: string;
	/** Default true — vim is core, not a setting. */
	vimEnabled?: boolean;
	/** Fired after a 250 ms idle window of inactivity. Receives the full buffer text. */
	onChange: (text: string) => void;
	/** Fired after a 1 s idle window. Receives the top-line scroll offset. */
	onScroll?: (top: number) => void;
	/** Optional initial cursor / selection range expressed in source byte offsets. */
	initialSelection?: { from: number; to: number };
}

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
