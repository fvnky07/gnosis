/**
 * Vim-style navigation for the date+time picker inside `ScheduleCaptureDialog`.
 *
 *   Shift+H / Shift+L  → previous / next day
 *   Shift+K / Shift+J  → previous / next week
 *   Shift+B / Shift+W  → previous / next month
 *
 * The Shift modifier is required so plain `hjkl` typing inside the dialog's
 * `<input>` (the title field) is unaffected. The hook listens on a scoped
 * root element (the dialog container) instead of `window` so the same chord
 * works elsewhere without conflict.
 *
 * `react-day-picker` v10 has no imperative focus API — we rely on the
 * controlled `selected` + `month` props on `<Calendar>` to follow the value
 * the hook mutates here, which is what the user perceives as "the cursor
 * moved." See https://daypicker.dev/api for the v10 controlled-state docs.
 */

import { useEffect } from "react";
import type { DateTimePickerValue } from "../components/DateTimePicker24h";

export interface CalendarVimNavOptions {
	/**
	 * Element the hook listens on. Pass the dialog content's root ref so the
	 * chord only fires while the dialog is focused. Falsy values disable.
	 */
	target: HTMLElement | null;
	value: DateTimePickerValue | null;
	onChange: (next: DateTimePickerValue) => void;
	/** Set false to suspend the hook (e.g. dialog closed). */
	enabled?: boolean;
}

export function useCalendarVimNav({
	target,
	value,
	onChange,
	enabled = true,
}: CalendarVimNavOptions): void {
	useEffect(() => {
		if (!enabled || !target) return;

		function handleKey(event: KeyboardEvent) {
			if (!event.shiftKey) return;
			// Skip when the chord matches a system shortcut.
			if (event.metaKey || event.ctrlKey || event.altKey) return;

			const key = event.key.toLowerCase();
			const base = value?.date ?? new Date();
			const next = new Date(base);

			switch (key) {
				case "h":
					next.setDate(base.getDate() - 1);
					break;
				case "l":
					next.setDate(base.getDate() + 1);
					break;
				case "k":
					next.setDate(base.getDate() - 7);
					break;
				case "j":
					next.setDate(base.getDate() + 7);
					break;
				case "b":
					next.setMonth(base.getMonth() - 1);
					break;
				case "w":
					next.setMonth(base.getMonth() + 1);
					break;
				default:
					return;
			}

			event.preventDefault();
			event.stopPropagation();
			onChange({ date: next, allDay: value?.allDay ?? false });
		}

		target.addEventListener("keydown", handleKey);
		return () => {
			target.removeEventListener("keydown", handleKey);
		};
	}, [target, value, onChange, enabled]);
}
