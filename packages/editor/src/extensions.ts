import {
	autocompletion,
	closeBrackets,
	completionKeymap,
} from "@codemirror/autocomplete";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { searchKeymap } from "@codemirror/search";
import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { findOrgTokens, ORG_TOKEN_CLASS } from "./highlight";

/**
 * Decoration plugin: re-runs {@link findOrgTokens} against the visible
 * document on every doc change and produces a `DecorationSet` of inline
 * mark decorations. Each token gets a CSS class from {@link ORG_TOKEN_CLASS}.
 *
 * MVP runs the regex pass on the full document on every doc change, which is
 * fine for files under a few thousand lines. A viewport-scoped pass is a
 * future optimization (issue E1 superseded once a real grammar lands).
 */
export const gnosisOrgExtras = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations },
);

function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const text = view.state.doc.toString();
	const tokens = findOrgTokens(text);
	for (const token of tokens) {
		builder.add(
			token.start,
			token.end,
			Decoration.mark({ class: ORG_TOKEN_CLASS[token.kind] }),
		);
	}
	return builder.finish();
}

/**
 * Standard extension stack for an org-flavored editor. Composition order
 * matters: keymaps are added with the `keymap.of` wrapper, syntax
 * highlighting overlays live between language support and the org-extras
 * decoration plugin.
 */
export function buildBaseExtensions(): Extension[] {
	return [
		history(),
		closeBrackets(),
		autocompletion(),
		EditorView.lineWrapping,
		markdown(),
		gnosisOrgExtras,
		keymap.of([
			...defaultKeymap,
			...historyKeymap,
			...searchKeymap,
			...completionKeymap,
			indentWithTab,
		]),
	];
}
