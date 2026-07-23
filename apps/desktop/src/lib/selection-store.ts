import type { SelectionInfo } from "@gnosis/editor";
import { create } from "zustand";

interface SelectionState {
	selection: SelectionInfo | null;
	setSelection: (info: SelectionInfo | null) => void;
}

// Isolated store so cursor motion (j/k) only re-renders subscribers (the
// TopBar status slots) and not the whole shell. Lifting this above App.tsx
// previously caused agenda panes to remount on every keystroke because the
// ViewCard JSX nodes passed to Schedule-X's `customComponents` were recreated
// on each ReadyShell render.
export const useSelectionStore = create<SelectionState>((set) => ({
	selection: null,
	setSelection: (info) => set({ selection: info }),
}));
