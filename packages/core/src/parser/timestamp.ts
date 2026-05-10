import type { OrgTimestamp } from "./types";

const TIMESTAMP_RE =
	/^([<[])(\d{4}-\d{2}-\d{2})(?:\s+[A-Za-z]{2,4})?(?:\s+(\d{2}:\d{2}))?([>\]])$/;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface FormatOptions {
	/** `<...>` (active) vs `[...]` (inactive). */
	active: boolean;
	/**
	 * Whether to include the `HH:MM` clock segment. Defaults to true if the
	 * input date has a non-midnight time component.
	 */
	includeTime?: boolean;
}

/**
 * Parse an org timestamp like `<2026-05-07 Thu 09:00>` or `[2026-05-07 Thu]`.
 * Returns `null` if the input is malformed or has mismatched delimiters.
 *
 * Day names (Mon/Tue/...) are accepted but not validated against the date —
 * the spec mandates them in human-written timestamps but doesn't require
 * them, and we never emit them from the date alone.
 */
export function parseOrgTimestamp(raw: string): OrgTimestamp | null {
	const m = TIMESTAMP_RE.exec(raw);
	if (!m) return null;
	const [, open, date, time, close] = m;
	const isActive = open === "<";
	const isClosingActive = close === ">";
	if (isActive !== isClosingActive) return null;
	const result: OrgTimestamp = {
		raw,
		active: isActive,
		date,
	};
	if (time) result.time = time;
	return result;
}

/**
 * Format a Date as an org-mode timestamp. Used by the palette boundary to
 * normalize chrono-node output before passing strings into the splice
 * emitters in `emit.ts`.
 */
export function formatOrgTimestamp(date: Date, opts: FormatOptions): string {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const day = DAY_NAMES[date.getDay()];
	const open = opts.active ? "<" : "[";
	const close = opts.active ? ">" : "]";
	const includeTime =
		opts.includeTime ?? (date.getHours() !== 0 || date.getMinutes() !== 0);
	if (includeTime) {
		const hh = String(date.getHours()).padStart(2, "0");
		const mi = String(date.getMinutes()).padStart(2, "0");
		return `${open}${yyyy}-${mm}-${dd} ${day} ${hh}:${mi}${close}`;
	}
	return `${open}${yyyy}-${mm}-${dd} ${day}${close}`;
}
