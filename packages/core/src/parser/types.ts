/**
 * Public types for the gnosis org parser. The parser produces a {@link Document}
 * with metadata and a flat list of {@link Block}s. Heading depth is a number on
 * each block; views derive children on demand.
 *
 * The {@link Document.raw} string plus per-block {@link Block.rangeInFile} byte
 * offsets are what make round-trip safety achievable: edits are splices into
 * `raw`, never AST → string re-emits.
 */

/** TODO state recognized by the MVP parser. No custom keyword sets. */
export type TodoState = "TODO" | "DONE";

/** Priority cookie recognized by the MVP parser. */
export type Priority = "A" | "B" | "C";

/**
 * An org timestamp, e.g. `<2026-05-07 Thu 09:00>` or `[2026-05-07 Thu]`.
 * The `raw` field is preserved for byte-exact round-trip.
 */
export interface OrgTimestamp {
	/** Original string including delimiters, for round-trip splices. */
	raw: string;
	/** True for `<...>` (active), false for `[...]` (inactive). */
	active: boolean;
	/** ISO date `YYYY-MM-DD`. */
	date: string;
	/** Optional `HH:MM` clock time. */
	time?: string;
}

/** Half-open `[start, end)` byte range in a parent file. */
export interface ByteRange {
	start: number;
	end: number;
}

/** A new block to append via {@link emitAppendBlock}. ID is minted by emit. */
export interface NewBlock {
	level: number;
	todo?: TodoState;
	priority?: Priority;
	title: string;
	tags?: string[];
	properties?: Record<string, string>;
	scheduled?: OrgTimestamp;
	deadline?: OrgTimestamp;
	body?: string;
}

/** A parsed heading and everything that belongs to it (drawer, planning, body). */
export interface Block {
	/** ULID, from `:ID:` property or freshly minted. */
	id: string;
	/** Heading depth: 1 for `*`, 2 for `**`, ... */
	level: number;
	todo?: TodoState;
	priority?: Priority;
	/** Heading text with TODO/priority/tags stripped. */
	title: string;
	/**
	 * Effective tag set: file tags ∪ local tags ∪ ancestor-heading tags. The
	 * parser denormalizes this so views don't have to walk the tree.
	 */
	tags: string[];
	/** Properties drawer key/value pairs (single-line values only in MVP). */
	properties: Record<string, string>;
	scheduled?: OrgTimestamp;
	deadline?: OrgTimestamp;
	/**
	 * Raw body text between this heading and the next, with the properties
	 * drawer and planning line stripped. The parser does not re-emit body —
	 * the editor owns whole-file writes.
	 */
	body: string;
	/** Byte offsets of the block (heading line through last body byte). */
	rangeInFile: ByteRange;
}

/** Output of {@link parse}. */
export interface Document {
	/** Source path supplied to {@link parse}, stored unchanged. */
	path: string;
	/** From `#+TITLE:` if present. */
	title?: string;
	/** From `#+FILETAGS:` if present. Always lowercased. */
	fileTags: string[];
	/** Raw text before the first heading line. */
	preamble: string;
	blocks: Block[];
	/** Full original text, for round-trip splices. */
	raw: string;
}

/** Severity of a {@link ParseWarning}. */
export type WarningSeverity = "info" | "warn";

/** A non-fatal parse anomaly. Surfaced in logs and the "recently parsed with
 * warnings" palette command. */
export interface ParseWarning {
	severity: WarningSeverity;
	/** Stable code, used for grouping in UI. */
	code: ParseWarningCode;
	/** Human-readable explanation. */
	message: string;
	/** Byte range in the source that triggered the warning, if applicable. */
	range?: ByteRange;
}

/** Closed enum of parse-warning codes. Add new codes here, never inline strings. */
export type ParseWarningCode =
	| "multiline-property-value"
	| "unknown-todo-keyword"
	| "malformed-timestamp"
	| "duplicate-id"
	| "unterminated-properties-drawer";

/** Result of {@link parse}. */
export interface ParseResult {
	document: Document;
	warnings: ParseWarning[];
}

/** Parsed pieces of a single heading line. */
export interface ParsedHeadline {
	level: number;
	todo?: TodoState;
	priority?: Priority;
	title: string;
	/** Local heading tags only, in source order. Lowercased. */
	tags: string[];
}
