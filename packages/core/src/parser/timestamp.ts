import type { OrgTimestamp } from "./types";

const TIMESTAMP_RE =
	/^([<[])(\d{4}-\d{2}-\d{2})(?:\s+[A-Za-z]{2,4})?(?:\s+(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?)?([>\]])$/;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface FormatOptions {
	/** `<...>` (active) vs `[...]` (inactive). */
	active: boolean;
	/**
	 * Whether to include the `HH:MM` clock segment. Defaults to true if the
	 * input date has a non-midnight time component.
	 */
	includeTime?: boolean;
	/**
	 * Optional `HH:MM` end-of-range time. When supplied alongside an included
	 * start time, the emitter renders `HH:MM-HH:MM` (single-day range).
	 * Ignored when `includeTime` resolves to false.
	 */
	endTime?: string;
}

/**
 * Parse an org timestamp like `<2026-05-07 Thu 09:00>`,
 * `<2026-05-07 Thu 09:00-10:30>`, or `[2026-05-07 Thu]`. Returns `null`
 * if the input is malformed or has mismatched delimiters.
 *
 * Day names (Mon/Tue/...) are accepted but not validated against the date —
 * the spec mandates them in human-written timestamps but doesn't require
 * them, and we never emit them from the date alone.
 */
export function parseOrgTimestamp(raw: string): OrgTimestamp | null {
	const m = TIMESTAMP_RE.exec(raw);
	if (!m) return null;
	const [, open, date, time, endTime, close] = m;
	// Required groups must be present whenever the regex matches; the explicit
	// guards both narrow TS's `string | undefined` typing for indexed regex
	// groups and act as a defensive bound against future regex edits.
	if (open === undefined || date === undefined || close === undefined) {
		return null;
	}
	const isActive = open === "<";
	const isClosingActive = close === ">";
	if (isActive !== isClosingActive) return null;
	const result: OrgTimestamp = {
		raw,
		active: isActive,
		date,
	};
	if (time) result.time = time;
	if (endTime) result.endTime = endTime;
	return result;
}

/**
 * Format a Date as an org-mode timestamp string. Used by the palette
 * boundary to normalize chrono-node output before passing strings into the
 * splice emitters in `emit.ts`. When `opts.endTime` is supplied alongside
 * an included start time the result carries the single-day range form
 * `HH:MM-HH:MM`.
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
		const time = opts.endTime ? `${hh}:${mi}-${opts.endTime}` : `${hh}:${mi}`;
		return `${open}${yyyy}-${mm}-${dd} ${day} ${time}${close}`;
	}
	return `${open}${yyyy}-${mm}-${dd} ${day}${close}`;
}

/**
 * Object-returning sibling of {@link formatOrgTimestamp}. Builds an
 * {@link OrgTimestamp} ready to drop into `NewBlock.scheduled` /
 * `NewBlock.deadline` without a separate parse step. The returned object's
 * `raw` field round-trips through {@link parseOrgTimestamp} bit-for-bit.
 */
export function buildOrgTimestamp(
	date: Date,
	options: { withTime?: boolean; active?: boolean; endTime?: string } = {},
): OrgTimestamp {
	const { withTime = false, active = true, endTime } = options;
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const dateStr = `${yyyy}-${mm}-${dd}`;
	const raw = formatOrgTimestamp(date, {
		active,
		includeTime: withTime,
		endTime: withTime ? endTime : undefined,
	});
	if (!withTime) {
		return { raw, active, date: dateStr };
	}
	const hh = String(date.getHours()).padStart(2, "0");
	const mi = String(date.getMinutes()).padStart(2, "0");
	const result: OrgTimestamp = {
		raw,
		active,
		date: dateStr,
		time: `${hh}:${mi}`,
	};
	if (endTime) result.endTime = endTime;
	return result;
}
