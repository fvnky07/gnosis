import type { PaletteMode } from "./types";

/**
 * Two orthogonal axes:
 *
 * 1. `mode` — which provider domain the palette is currently in
 *    (`root`/`commands`/`capture`/etc.). Driven by the user's prefix typing
 *    or by an explicit submode push (e.g. opening a sub-action list).
 * 2. `cursor` — whether keyboard focus lives in the filter input
 *    (`INSERT`) or in the result list (`LIST`). Independent of `mode`.
 *
 * The reducer is pure so it's deterministic to test. It does NOT touch the
 * provider registry or run side effects — those live in the React layer.
 */

export type CursorState = "INSERT" | "LIST" | "SUB";

export interface PaletteState {
	open: boolean;
	mode: PaletteMode;
	cursor: CursorState;
	query: string;
	/** Index of the highlighted result, 0-based. */
	highlight: number;
	/** Stack used by `Esc` to pop sub-modes back to root, then close. */
	modeStack: PaletteMode[];
}

export type PaletteAction =
	| { type: "open" }
	| { type: "close" }
	| { type: "set-query"; query: string }
	| { type: "set-mode"; mode: PaletteMode }
	| { type: "push-mode"; mode: PaletteMode }
	| { type: "set-cursor"; cursor: CursorState }
	| { type: "highlight-set"; index: number }
	| { type: "highlight-move"; delta: number; total: number }
	| { type: "highlight-edge"; edge: "first" | "last"; total: number }
	| { type: "escape"; total: number };

export const INITIAL_STATE: PaletteState = {
	open: false,
	mode: "root",
	cursor: "INSERT",
	query: "",
	highlight: 0,
	modeStack: [],
};

export function paletteReducer(
	state: PaletteState,
	action: PaletteAction,
): PaletteState {
	switch (action.type) {
		case "open":
			return { ...INITIAL_STATE, open: true };
		case "close":
			return { ...INITIAL_STATE, open: false };
		case "set-query":
			return { ...state, query: action.query, highlight: 0 };
		case "set-mode":
			return { ...state, mode: action.mode, modeStack: [], highlight: 0 };
		case "push-mode":
			return {
				...state,
				modeStack: [...state.modeStack, state.mode],
				mode: action.mode,
				highlight: 0,
			};
		case "set-cursor":
			return { ...state, cursor: action.cursor };
		case "highlight-set":
			return { ...state, highlight: action.index };
		case "highlight-move": {
			if (action.total <= 0) return { ...state, highlight: 0 };
			const next =
				(state.highlight + action.delta + action.total) % action.total;
			return { ...state, highlight: next };
		}
		case "highlight-edge":
			return {
				...state,
				highlight: action.edge === "first" ? 0 : Math.max(0, action.total - 1),
			};
		case "escape":
			// Esc behavior depends on cursor:
			//   INSERT → switch to LIST (still in palette).
			//   LIST   → if there's a sub-mode on the stack, pop one; else close.
			//   SUB    → return to LIST.
			if (state.cursor === "INSERT") {
				return { ...state, cursor: "LIST" };
			}
			if (state.cursor === "SUB") {
				return { ...state, cursor: "LIST" };
			}
			if (state.modeStack.length > 0) {
				const previous = state.modeStack[state.modeStack.length - 1];
				return {
					...state,
					mode: previous,
					modeStack: state.modeStack.slice(0, -1),
					highlight: 0,
				};
			}
			return { ...INITIAL_STATE, open: false };
	}
}
