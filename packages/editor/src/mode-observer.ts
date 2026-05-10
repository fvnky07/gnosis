import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { vimState } from "@replit/codemirror-vim";
import { getCM } from "@replit/codemirror-vim";

export type VimMode =
	| "NORMAL"
	| "INSERT"
	| "VISUAL"
	| "REPLACE"
	| "COMMAND"
	| "LIST"
	| "LEADER";

export function vimModeWatcher(
	onModeChange: (mode: VimMode) => void,
): Extension {
	let lastMode: VimMode = "NORMAL";
	return EditorView.updateListener.of((update) => {
		try {
			const cm = getCM(update.view);
			if (!cm) return;
			const vimSt = cm.state?.vim as vimState | null | undefined;
			if (!vimSt) return;
			const next = inferMode(vimSt);
			if (next !== lastMode) {
				lastMode = next;
				onModeChange(next);
			}
		} catch {
			// cm-vim not initialized yet; ignore
		}
	});
}

function inferMode(v: vimState): VimMode {
	if (v.insertMode) return "INSERT";
	if (v.visualMode) return "VISUAL";
	// replaceMode is not on vimState type — use a cast for runtime duck-typing
	if ((v as unknown as { replaceMode?: boolean }).replaceMode) return "REPLACE";
	return "NORMAL";
}
