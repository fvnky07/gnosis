import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { buildBaseExtensions } from "./extensions";
import { vimModeWatcher } from "./mode-observer";
import { buildOrgMotions } from "./motions";
import type { BufferProps } from "./types";
import { buildVimExtensions } from "./vim";

const WRITE_DEBOUNCE_MS = 250;
const SCROLL_DEBOUNCE_MS = 1000;

/**
 * Mount a CodeMirror editor inside `parent`. Returns the EditorView so
 * callers (typically the React `<EditorPane>` wrapper in `apps/desktop`)
 * can dispatch updates and tear it down on unmount.
 *
 * Per `planning/08-editor.md`:
 * - vim is on by default unless the caller passes `vimEnabled: false`.
 * - `onChange` fires after 250 ms of input idleness — not on every
 *   keystroke. Crash mid-keystroke loses up to ~250 ms of typing.
 * - `onScroll` fires after 1 s of scroll idleness.
 *
 * The editor sees plain text only. Parsing is the indexer's job; the editor
 * just hands raw bytes back through `onChange`.
 */
export function createEditor(
	parent: HTMLElement,
	props: BufferProps,
): EditorView {
	const {
		initialDoc,
		vimEnabled = true,
		onChange,
		onScroll,
		vimHostBindings,
		onVimModeChange,
	} = props;

	let writeTimer: ReturnType<typeof setTimeout> | null = null;
	let scrollTimer: ReturnType<typeof setTimeout> | null = null;
	let lastFlushedDoc = initialDoc;

	const docChangeListener = EditorView.updateListener.of((update) => {
		if (update.docChanged) {
			if (writeTimer) clearTimeout(writeTimer);
			writeTimer = setTimeout(() => {
				const text = update.state.doc.toString();
				if (text === lastFlushedDoc) return;
				lastFlushedDoc = text;
				onChange(text);
			}, WRITE_DEBOUNCE_MS);
		}
		if (onScroll && update.geometryChanged) {
			if (scrollTimer) clearTimeout(scrollTimer);
			scrollTimer = setTimeout(() => {
				onScroll(update.view.scrollDOM.scrollTop);
			}, SCROLL_DEBOUNCE_MS);
		}
	});

	// vim() must precede the keymap of the base extensions so cm-vim's keys win
	// over default editor bindings — cm-vim's docs require this ordering.
	const extensions = [
		...(vimEnabled ? buildVimExtensions(vimHostBindings) : []),
		...(vimEnabled ? buildOrgMotions() : []),
		...(vimEnabled && onVimModeChange ? [vimModeWatcher(onVimModeChange)] : []),
		...buildBaseExtensions(),
		docChangeListener,
	];

	const state = EditorState.create({
		doc: initialDoc,
		extensions,
		selection: props.initialSelection
			? { anchor: props.initialSelection.from, head: props.initialSelection.to }
			: undefined,
	});

	return new EditorView({ state, parent });
}
