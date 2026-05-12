/**
 * Natural-language → schedule parser. Wraps `chrono-node` with the project's
 * defaults so the schedule-capture dialog can offer a single palette-style
 * input ("Buy milk tomorrow at 3pm for 2h") that drives the calendar +
 * time fields below in real time.
 *
 * Design notes:
 *   - We always pick the **last** chrono result. Trailing temporal phrases
 *     win, so "Tuesday review meeting tomorrow" schedules tomorrow rather
 *     than next Tuesday — matches how palette inputs read left-to-right.
 *   - `forwardDate: true` so bare weekdays mean *next* occurrence (no
 *     accidentally scheduling into last week).
 *   - All-day detection uses `result.start.isCertain('hour')`. When chrono
 *     didn't see a clock component the result is treated as all-day even
 *     though `result.start.date()` returns midnight.
 *   - The temporal phrase is sliced out of the source so the remainder
 *     becomes the block heading; multiple internal spaces collapse so we
 *     don't end up with "Buy  milk".
 *
 * Pure module — no React, no DOM, no I/O. Safe to unit-test in isolation.
 */

import * as chrono from "chrono-node";

export interface ParsedSchedule {
	/** Title text with the temporal phrase sliced out, trimmed. */
	title: string;
	/** Start date+time, or null if no temporal phrase was found. */
	start: Date | null;
	/** End date+time, or null when chrono returned no `.end`. */
	end: Date | null;
	/** True when the temporal phrase had no clock component. */
	allDay: boolean;
	/**
	 * Half-open `[start, end)` indices of the temporal phrase in the source
	 * string, so callers can highlight or strip it. `null` when no phrase
	 * was matched.
	 */
	range: { index: number; length: number } | null;
}

const COLLAPSE_WS = /\s+/g;

export function parseNaturalSchedule(
	input: string,
	ref: Date = new Date(),
): ParsedSchedule {
	const text = input ?? "";
	const results = chrono.parse(text, ref, { forwardDate: true });
	const last = results[results.length - 1];
	if (!last) {
		return {
			title: text.trim(),
			start: null,
			end: null,
			allDay: true,
			range: null,
		};
	}

	const start = last.start.date();
	const end = last.end ? last.end.date() : null;
	const allDay = !last.start.isCertain("hour");

	const sliceStart = last.index;
	const sliceEnd = last.index + last.text.length;
	const title = (text.slice(0, sliceStart) + text.slice(sliceEnd))
		.replace(COLLAPSE_WS, " ")
		.trim();

	return {
		title,
		start,
		end,
		allDay,
		range: { index: sliceStart, length: last.text.length },
	};
}
