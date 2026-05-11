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
import {
	bracketMatching,
	foldGutter,
	indentOnInput,
	indentUnit,
} from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import {
	EditorState,
	type Extension,
	RangeSetBuilder,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import { findOrgTokens, ORG_TOKEN_CLASS } from "./highlight";
import { DEFAULT_EDITOR_OPTIONS, type EditorOptions } from "./types";

/**
 * Decoration plugin: re-runs {@link findOrgTokens} against the visible
 * document on every doc change and produces a `DecorationSet` of inline
 * mark decorations. Each token gets a CSS class from {@link ORG_TOKEN_CLASS}.
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
 * Build the base CodeMirror extension stack. Options drive which extensions
 * are added and how the editor theme is configured. Defaults match the
 * pre-settings behavior: line wrap on, no line numbers, fold gutter on,
 * bracket matching and close-brackets on.
 */
export function buildBaseExtensions(
	opts: EditorOptions = DEFAULT_EDITOR_OPTIONS,
): Extension[] {
	const extensions: Extension[] = [
		history(),
		EditorState.tabSize.of(opts.tabSize),
		indentUnit.of(opts.insertSpaces ? " ".repeat(opts.tabSize) : "\t"),
		indentOnInput(),
		markdown(),
		gnosisOrgExtras,
	];

	if (opts.wordWrap) extensions.push(EditorView.lineWrapping);
	if (opts.lineNumbers !== "off") {
		extensions.push(
			lineNumbers({
				formatNumber:
					opts.lineNumbers === "relative"
						? (lineNo, state) => {
								const cursor = state.doc.lineAt(
									state.selection.main.head,
								).number;
								if (lineNo === cursor) return String(lineNo);
								return String(Math.abs(lineNo - cursor));
							}
						: undefined,
			}),
		);
	}
	if (opts.foldGutter) extensions.push(foldGutter());
	if (opts.highlightActiveLine) {
		extensions.push(highlightActiveLine(), highlightActiveLineGutter());
	}
	if (opts.matchBrackets) extensions.push(bracketMatching());
	if (opts.closeBrackets) extensions.push(closeBrackets());
	if (opts.autocomplete) extensions.push(autocompletion());

	extensions.push(buildEditorTheme(opts));

	extensions.push(
		keymap.of([
			...defaultKeymap,
			...historyKeymap,
			...searchKeymap,
			...completionKeymap,
			indentWithTab,
		]),
	);

	return extensions;
}

/**
 * Theme extension derived from `EditorOptions`. Drives font-family/size,
 * line-height, letter-spacing, cursor style/width, ligature features, and
 * column rulers. The host stylesheet still ships overall .cm-editor sizing
 * via CSS variables; this theme is the per-instance override.
 */
function buildEditorTheme(opts: EditorOptions): Extension {
	const fontFamily = opts.fontFamily.trim() || "ui-monospace";
	const fontFamilyStack = fontFamily.includes(",")
		? fontFamily
		: `"${fontFamily.replace(/"/g, "")}", ui-monospace, monospace`;

	const caret = "var(--accent-color, var(--ring))";
	const cursorRule: Record<string, string> = {};
	if (opts.cursorStyle === "block") {
		cursorRule.width = "0.6em";
		cursorRule.background = caret;
		cursorRule.opacity = "0.4";
	} else if (opts.cursorStyle === "underline") {
		cursorRule.borderLeft = "0";
		cursorRule.borderBottom = `${opts.cursorWidthPx}px solid ${caret}`;
		cursorRule.height = "1.2em";
	} else {
		cursorRule.borderLeftWidth = `${opts.cursorWidthPx}px`;
		cursorRule.borderLeftColor = caret;
	}

	const rulerColors = parseRulers(opts.rulers);

	return EditorView.theme({
		"&": {
			fontFamily: fontFamilyStack,
			fontSize: `${opts.fontSize}px`,
			letterSpacing: `${opts.letterSpacingPx}px`,
			fontFeatureSettings: opts.fontLigatures ? "normal" : '"liga" 0, "calt" 0',
		},
		".cm-scroller": {
			fontFamily: "inherit",
			lineHeight: `${opts.lineHeight}`,
		},
		".cm-content": {
			caretColor: "var(--accent-color, var(--ring))",
		},
		".cm-cursor, .cm-dropCursor": cursorRule,
		"&.cm-focused .cm-cursor": opts.cursorBlink
			? { animation: "cm-blink 1s steps(1) infinite" }
			: { animation: "none" },
		".cm-line": rulerColors,
	});
}

function parseRulers(spec: string): Record<string, string> {
	if (!spec.trim()) return {};
	const cols = spec
		.split(",")
		.map((s) => Number.parseInt(s.trim(), 10))
		.filter((n) => Number.isFinite(n) && n > 0);
	if (cols.length === 0) return {};
	const stops = cols
		.map(
			(c) =>
				`var(--ring) ${c}ch, var(--ring) calc(${c}ch + 1px), transparent calc(${c}ch + 1px)`,
		)
		.join(", transparent 0, ");
	return {
		backgroundImage: `linear-gradient(to right, transparent 0, ${stops})`,
		backgroundRepeat: "no-repeat",
	};
}
