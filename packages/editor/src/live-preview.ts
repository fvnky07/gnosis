import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { findOrgProseTokens, ORG_PROSE_BODY_CLASS } from "./highlight";
import type { OrgProseTokenKind } from "./types";

/**
 * Obsidian/Logseq-style live preview for org buffers.
 *
 * Source text is never rewritten. Decorations overlay heading-line classes
 * (`cm-org-h1`…`cm-org-h6`) plus mark decorations that either hide org
 * syntax noise (heading stars, emphasis delimiters, link punctuation, raw
 * URL in `[[url][label]]`) via the `cm-org-hidden` class or style the
 * visible body (bold/italic/underline/verbatim/code/strike, link label).
 *
 * Cursor-aware reveal: when the main selection sits on a given line, the
 * hide decorations for tokens on that line are suppressed so the user can
 * edit raw markup. Moving the cursor to another line re-hides the markup
 * on the next `selectionSet` update.
 *
 * Recognised emphasis follows Emacs' default
 * `org-emphasis-regexp-components`; see `highlight.ts` for the exact
 * regex. The implementation is intentionally regex-based instead of using
 * a full AST parser (uniorg / orga) — prose-level rendering does not need
 * incremental parsing, and avoiding the AST dep keeps the bundle small.
 */

const HIDDEN_KINDS = new Set<OrgProseTokenKind>([
	"heading-mark-1",
	"heading-mark-2",
	"heading-mark-3",
	"heading-mark-4",
	"heading-mark-5",
	"heading-mark-6",
	"emphasis-bold-mark",
	"emphasis-italic-mark",
	"emphasis-underline-mark",
	"emphasis-verbatim-mark",
	"emphasis-code-mark",
	"emphasis-strike-mark",
	"link-bracket",
]);

const hiddenDeco = Decoration.mark({ class: "cm-org-hidden" });
const HEADING_LINE_DECOS = [1, 2, 3, 4, 5, 6].map((n) =>
	Decoration.line({ class: `cm-org-h${n}` }),
);

const livePreviewContentAttrs = EditorView.contentAttributes.of({
	"data-org-live-preview": "1",
});

function build(view: EditorView): DecorationSet {
	const ranges: ReturnType<Decoration["range"]>[] = [];
	const doc = view.state.doc;
	const cursorLine = doc.lineAt(view.state.selection.main.head);
	const text = doc.toString();
	const tokens = findOrgProseTokens(text);

	for (const t of tokens) {
		const tStart = t.start;
		const tEnd = t.end;
		const lineAtStart = doc.lineAt(tStart);
		const onCursorLine = lineAtStart.number === cursorLine.number;

		// Heading lines: emit a Decoration.line at the line start regardless
		// of cursor position so headings stay sized while editing them.
		if (t.kind.startsWith("heading-mark-")) {
			const level = Number(t.kind.slice("heading-mark-".length));
			const lineDeco = HEADING_LINE_DECOS[level - 1];
			if (lineDeco) {
				ranges.push(lineDeco.range(lineAtStart.from));
			}
			if (!onCursorLine) {
				ranges.push(hiddenDeco.range(tStart, tEnd));
			}
			continue;
		}

		// Hide link URL only when a label is present — the live-preview
		// plugin looks one token ahead via the sorted-by-start order to
		// decide. To keep that decision local we mark link-url unconditionally
		// as styled (cm-org-link); the *url* is hidden only when followed by
		// `][`, which findOrgProseTokens emits as a `link-bracket` token. To
		// simplify, treat bare `[[url]]` (no label) as: hide the brackets,
		// keep the url visible and styled.
		// Link-url hiding: handled below by checking the adjacent tokens.

		if (HIDDEN_KINDS.has(t.kind)) {
			if (!onCursorLine) ranges.push(hiddenDeco.range(tStart, tEnd));
			continue;
		}

		const cls = ORG_PROSE_BODY_CLASS[t.kind];
		if (cls) {
			ranges.push(Decoration.mark({ class: cls }).range(tStart, tEnd));
		}
	}

	// Post-pass: hide `link-url` tokens when a `link-label` follows on the
	// same link. Detect by adjacent bracket→url→bracket→label→bracket sequence.
	hideUrlsWhenLabeled(tokens, cursorLine.number, doc, ranges);

	return Decoration.set(ranges, /* sort */ true);
}

function hideUrlsWhenLabeled(
	tokens: ReturnType<typeof findOrgProseTokens>,
	cursorLineNumber: number,
	doc: { lineAt: (pos: number) => { number: number } },
	out: ReturnType<Decoration["range"]>[],
): void {
	for (let i = 0; i < tokens.length; i++) {
		const cur = tokens[i];
		if (!cur || cur.kind !== "link-url") continue;
		// Pattern emitted by findOrgProseTokens for `[[url][label]]`:
		// link-bracket → link-url → link-bracket → link-label → link-bracket
		const next = tokens[i + 1];
		const after = tokens[i + 2];
		if (next?.kind !== "link-bracket" || after?.kind !== "link-label") {
			continue;
		}
		const onCursorLine = doc.lineAt(cur.start).number === cursorLineNumber;
		if (!onCursorLine) out.push(hiddenDeco.range(cur.start, cur.end));
	}
}

export const orgLivePreviewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = build(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = build(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations },
);

/** Extension bundle: plugin + content-attribute marker for CSS scoping. */
export const livePreviewExtension = [
	orgLivePreviewPlugin,
	livePreviewContentAttrs,
];

/** Back-compat alias for the previous markdown-flavoured export name. */
export const livePreviewPlugin = orgLivePreviewPlugin;
