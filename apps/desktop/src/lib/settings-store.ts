import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
	/** Editor column width as a percentage of the card's available width.
	 * Drives the centered text column inside the editor card. */
	noteWidthPct: number;
	setNoteWidthPct(value: number): void;
	/** Whether the bottom status bar is shown. */
	statusBarVisible: boolean;
	setStatusBarVisible(value: boolean): void;
	/** Whether vim modal editing is active across the shell. */
	vimEnabled: boolean;
	setVimEnabled(value: boolean): void;
}

export const useSettings = create<SettingsState>()(
	persist(
		(set) => ({
			noteWidthPct: 60,
			setNoteWidthPct: (value) => set({ noteWidthPct: clamp(value, 30, 100) }),
			statusBarVisible: true,
			setStatusBarVisible: (value) => set({ statusBarVisible: value }),
			vimEnabled: true,
			setVimEnabled: (value) => set({ vimEnabled: value }),
		}),
		{
			name: "gnosis-settings",
			version: 1,
		},
	),
);

function clamp(n: number, min: number, max: number): number {
	if (Number.isNaN(n)) return min;
	return Math.min(max, Math.max(min, n));
}
