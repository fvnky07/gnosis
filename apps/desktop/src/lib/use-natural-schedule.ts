/**
 * Stateful controller behind the schedule-capture dialog. Owns:
 *
 *   - `inputText`  — the raw natural-language string in the palette input
 *   - `start` / `end` / `allDay` — the schedule the calendar + time fields
 *     render. Driven by the debounced chrono parse OR by direct mutator
 *     calls when the user clicks the calendar / edits a time input.
 *   - `title` — derived from `inputText` minus the temporal phrase, kept
 *     in lockstep with what the user sees so submit-time has nothing to
 *     reconcile.
 *
 * Two-way binding rule:
 *   - Typing in the NL input clears the per-field manual-override flags
 *     so the parser can repaint start/end on the next debounced tick.
 *   - Manual edits (`setStart` / `setEnd`) flip the corresponding
 *     manual-override flag; the parser stops touching that field until
 *     the next keystroke clears the flag again.
 *   - When the parser yields no temporal phrase (`result.start === null`)
 *     it leaves the existing schedule alone. Calendar selection persists
 *     across "Buy milk" → "Buy milk!" edits.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type ParsedSchedule,
	parseNaturalSchedule,
} from "./parse-natural-schedule";

const PARSE_DEBOUNCE_MS = 80;

export interface NaturalScheduleState {
	inputText: string;
	start: Date | null;
	end: Date | null;
	allDay: boolean;
	title: string;
	setInputText(next: string): void;
	setStart(next: Date): void;
	setEnd(next: Date | null): void;
	reset(seed?: Date): void;
}

export interface UseNaturalScheduleOptions {
	/** Default start time used on mount and on every `enabled` rising edge. */
	seed: Date;
	/**
	 * False when the dialog is closed — the hook stops the parser timer and
	 * clears state on the next rising edge so reopening looks fresh.
	 */
	enabled: boolean;
}

export function useNaturalSchedule({
	seed,
	enabled,
}: UseNaturalScheduleOptions): NaturalScheduleState {
	const [inputText, setInputText] = useState("");
	const [start, setStartState] = useState<Date | null>(seed);
	const [end, setEndState] = useState<Date | null>(null);
	const [allDay, setAllDay] = useState(false);
	const manualStartRef = useRef(false);
	const manualEndRef = useRef(false);
	// Track the previous enabled value so we only reseed on the false→true
	// transition (closing + reopening the dialog), not on every render.
	const prevEnabledRef = useRef(enabled);
	const seedRef = useRef(seed);
	seedRef.current = seed;

	useEffect(() => {
		const wasEnabled = prevEnabledRef.current;
		prevEnabledRef.current = enabled;
		if (!wasEnabled && enabled) {
			setInputText("");
			setStartState(seedRef.current);
			setEndState(null);
			setAllDay(false);
			manualStartRef.current = false;
			manualEndRef.current = false;
		}
	}, [enabled]);

	// Debounced parser. Skipped while the dialog is closed so we don't churn
	// timers in the background after the user dismisses it.
	useEffect(() => {
		if (!enabled) return;
		const id = window.setTimeout(() => {
			const r: ParsedSchedule = parseNaturalSchedule(inputText);
			if (!r.start) return; // no temporal phrase ⇒ leave state alone
			if (!manualStartRef.current) setStartState(r.start);
			if (!manualEndRef.current) setEndState(r.end);
			setAllDay(r.allDay);
		}, PARSE_DEBOUNCE_MS);
		return () => window.clearTimeout(id);
	}, [inputText, enabled]);

	const handleInputText = useCallback((next: string) => {
		// Each keystroke hands authority back to the parser so a fresh
		// temporal phrase repaints the calendar + time fields.
		manualStartRef.current = false;
		manualEndRef.current = false;
		setInputText(next);
	}, []);

	const handleSetStart = useCallback((next: Date) => {
		manualStartRef.current = true;
		setStartState(next);
	}, []);

	const handleSetEnd = useCallback((next: Date | null) => {
		manualEndRef.current = true;
		setEndState(next);
	}, []);

	const handleReset = useCallback((nextSeed?: Date) => {
		setInputText("");
		setStartState(nextSeed ?? seedRef.current);
		setEndState(null);
		setAllDay(false);
		manualStartRef.current = false;
		manualEndRef.current = false;
	}, []);

	// Title is derived from the raw input synchronously so the submit
	// guard (`!title.trim()`) reflects what the user sees the instant
	// they hit Enter — no debounce-window race with the parsed start.
	const title = useMemo(
		() => parseNaturalSchedule(inputText).title,
		[inputText],
	);

	return {
		inputText,
		start,
		end,
		allDay,
		title,
		setInputText: handleInputText,
		setStart: handleSetStart,
		setEnd: handleSetEnd,
		reset: handleReset,
	};
}
