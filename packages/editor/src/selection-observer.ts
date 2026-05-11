import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export interface SelectionInfo {
	/** 1-based line number of the primary selection's head. */
	line: number;
	/** 1-based column of the primary selection's head. */
	col: number;
	/** Total word count across the entire document. */
	totalWords: number;
	/** Words inside the current selection (0 when collapsed). */
	selectedWords: number;
	/** Total character count across the entire document. */
	totalChars: number;
	/** Characters inside the current selection (0 when collapsed). */
	selectedChars: number;
}

/**
 * Emits {@link SelectionInfo} whenever the user moves the cursor or edits
 * the doc. Word counts are computed via a single regex pass; documents
 * up to a few hundred KB run well under one frame per update.
 */
export function selectionWatcher(
	onChange: (info: SelectionInfo) => void,
): Extension {
	let lastInfo: SelectionInfo | null = null;

	return EditorView.updateListener.of((update) => {
		if (!update.docChanged && !update.selectionSet) return;
		const info = computeInfo(update.state);
		if (
			lastInfo &&
			info.line === lastInfo.line &&
			info.col === lastInfo.col &&
			info.totalWords === lastInfo.totalWords &&
			info.selectedWords === lastInfo.selectedWords &&
			info.totalChars === lastInfo.totalChars &&
			info.selectedChars === lastInfo.selectedChars
		) {
			return;
		}
		lastInfo = info;
		onChange(info);
	});
}

function computeInfo(state: EditorState): SelectionInfo {
	const main = state.selection.main;
	const lineObj = state.doc.lineAt(main.head);
	const line = lineObj.number;
	const col = main.head - lineObj.from + 1;
	const doc = state.doc.toString();
	const totalWords = countWords(doc);
	const totalChars = doc.length;
	const selectedRange =
		main.from === main.to ? "" : state.sliceDoc(main.from, main.to);
	const selectedWords = countWords(selectedRange);
	const selectedChars = selectedRange.length;
	return {
		line,
		col,
		totalWords,
		selectedWords,
		totalChars,
		selectedChars,
	};
}

function countWords(input: string): number {
	if (!input) return 0;
	const matches = input.match(/\S+/g);
	return matches ? matches.length : 0;
}
