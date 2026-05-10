import { create } from "zustand";

export type VimMode =
	| "NORMAL"
	| "INSERT"
	| "VISUAL"
	| "REPLACE"
	| "COMMAND"
	| "LIST"
	| "LEADER";

export type FocusLayer =
	| { kind: "editor" }
	| { kind: "palette" }
	| { kind: "view"; viewId: string }
	| { kind: "popover"; id: string }
	| { kind: "tab-switcher" };

interface VimRuntimeState {
	mode: VimMode;
	chord: string[];
	focusStack: FocusLayer[];
	leaderActive: boolean;
	leaderStartedAt: number | null;
	setMode: (mode: VimMode) => void;
	pushFocus: (layer: FocusLayer) => void;
	popFocus: () => FocusLayer | undefined;
	enterLeader: () => void;
	cancelLeader: () => void;
	appendChord: (key: string) => void;
	clearChord: () => void;
}

export const useVimRuntime = create<VimRuntimeState>((set, get) => ({
	mode: "INSERT",
	chord: [],
	focusStack: [{ kind: "editor" }],
	leaderActive: false,
	leaderStartedAt: null,
	setMode: (mode) => set({ mode }),
	pushFocus: (layer) => set({ focusStack: [...get().focusStack, layer] }),
	popFocus: () => {
		const stack = get().focusStack;
		if (stack.length <= 1) return undefined;
		const popped = stack[stack.length - 1];
		set({ focusStack: stack.slice(0, -1) });
		return popped;
	},
	enterLeader: () =>
		set({ leaderActive: true, leaderStartedAt: Date.now(), chord: [] }),
	cancelLeader: () =>
		set({ leaderActive: false, leaderStartedAt: null, chord: [] }),
	appendChord: (key) => set({ chord: [...get().chord, key] }),
	clearChord: () => set({ chord: [] }),
}));
