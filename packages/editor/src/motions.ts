import type { Extension } from "@codemirror/state";
import type {
	CodeMirrorV,
	InputStateInterface,
	MotionArgs,
	Pos,
	vimState,
} from "@replit/codemirror-vim";
import { Vim } from "@replit/codemirror-vim";

const HEADING_RE = /^(\*+)\s+/;

let registered = false;

export function buildOrgMotions(): Extension[] {
	if (!registered) {
		registerMotions();
		registered = true;
	}
	return [];
}

function registerMotions() {
	Vim.defineMotion(
		"orgNextHeading",
		(
			cm: CodeMirrorV,
			head: Pos,
			_motionArgs: MotionArgs,
			_vim: vimState,
			_inputState: InputStateInterface,
		) => nextHeading(cm, head, +1),
	);
	Vim.defineMotion(
		"orgPrevHeading",
		(
			cm: CodeMirrorV,
			head: Pos,
			_motionArgs: MotionArgs,
			_vim: vimState,
			_inputState: InputStateInterface,
		) => nextHeading(cm, head, -1),
	);
	Vim.defineMotion(
		"orgNextSameLevel",
		(
			cm: CodeMirrorV,
			head: Pos,
			_motionArgs: MotionArgs,
			_vim: vimState,
			_inputState: InputStateInterface,
		) => sameLevel(cm, head, +1),
	);
	Vim.defineMotion(
		"orgPrevSameLevel",
		(
			cm: CodeMirrorV,
			head: Pos,
			_motionArgs: MotionArgs,
			_vim: vimState,
			_inputState: InputStateInterface,
		) => sameLevel(cm, head, -1),
	);

	// Map keys to motions in normal + visual modes
	Vim.mapCommand("]]", "motion", "orgNextHeading", {}, { context: "normal" });
	Vim.mapCommand("[[", "motion", "orgPrevHeading", {}, { context: "normal" });
	Vim.mapCommand("]h", "motion", "orgNextSameLevel", {}, { context: "normal" });
	Vim.mapCommand("[h", "motion", "orgPrevSameLevel", {}, { context: "normal" });
	Vim.mapCommand("]]", "motion", "orgNextHeading", {}, { context: "visual" });
	Vim.mapCommand("[[", "motion", "orgPrevHeading", {}, { context: "visual" });
}

export interface CmLike {
	getLine(n: number): string;
	lineCount(): number;
}

export function nextHeading(
	cm: CmLike,
	head: { line: number; ch: number },
	dir: 1 | -1,
): { line: number; ch: number } {
	const total = cm.lineCount();
	let line = head.line + dir;
	while (line >= 0 && line < total) {
		if (HEADING_RE.test(cm.getLine(line))) {
			return { line, ch: 0 };
		}
		line += dir;
	}
	return { line: head.line, ch: head.ch };
}

export function sameLevel(
	cm: CmLike,
	head: { line: number; ch: number },
	dir: 1 | -1,
): { line: number; ch: number } {
	const cur = cm.getLine(head.line);
	const m = HEADING_RE.exec(cur);
	if (!m) return nextHeading(cm, head, dir);
	const targetLevel = m[1].length;
	const total = cm.lineCount();
	let line = head.line + dir;
	while (line >= 0 && line < total) {
		const txt = cm.getLine(line);
		const mm = HEADING_RE.exec(txt);
		if (mm) {
			if (mm[1].length === targetLevel) return { line, ch: 0 };
			if (mm[1].length < targetLevel) break;
		}
		line += dir;
	}
	return { line: head.line, ch: head.ch };
}
