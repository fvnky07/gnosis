import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";

/**
 * Obsidian-style live preview for markdown buffers.
 *
 * The plugin walks the Lezer syntax tree over the *visible* viewport on
 * every doc, viewport, or selection change and pushes `Decoration.mark`s
 * with class `cm-md-hidden` onto syntax-noise nodes (`HeaderMark`, `*`,
 * `_`, `` ` ``, link punctuation, etc.). Combined with `display:none` in
 * CSS this collapses the markup into rendered prose.
 *
 * Reveal-on-cursor: when the main selection sits inside a heading or
 * inline element we `return false` from the iterator to skip the subtree,
 * leaving the raw markdown visible on that line so the user can edit it.
 * Moving the cursor out re-hides the markup on the next `selectionSet`
 * update.
 */

const HIDDEN_TOKENS = new Set([
	"EmphasisMark", // * or _ around emphasis / strong
	"CodeMark", // ` around inline code
	"LinkMark", // [, ], (, )
	"URL", // raw URL inside [text](url)
	"QuoteMark", // > at start of blockquote
	"HardBreak",
]);

/**
 * Inline node names: when the cursor sits inside one of these, we leave
 * the whole subtree decorated as raw markdown for editing convenience.
 */
const REVEAL_ON_CURSOR = new Set([
	"Emphasis",
	"StrongEmphasis",
	"InlineCode",
	"Link",
	"Image",
	"Strikethrough",
]);

const hidden = Decoration.mark({ class: "cm-md-hidden" });

const livePreviewContentAttrs = EditorView.contentAttributes.of({
	"data-md-live-preview": "1",
});

function build(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const cursor = view.state.selection.main;
	const docLen = view.state.doc.length;
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: (node) => {
				// Cursor inside a heading or inline element → reveal raw markdown
				// for editing. Skip the entire subtree.
				if (
					(node.name.startsWith("ATXHeading") ||
						node.name.startsWith("SetextHeading") ||
						REVEAL_ON_CURSOR.has(node.name)) &&
					cursor.from >= node.from &&
					cursor.to <= node.to
				) {
					return false;
				}
				if (node.name === "HeaderMark") {
					// '#' plus the trailing space — clip at doc end.
					const end = Math.min(node.to + 1, docLen);
					builder.add(node.from, end, hidden);
					return;
				}
				if (HIDDEN_TOKENS.has(node.name)) {
					builder.add(node.from, node.to, hidden);
				}
			},
		});
	}
	return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
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
	livePreviewPlugin,
	livePreviewContentAttrs,
];
