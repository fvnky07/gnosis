import type { ViewBlock } from "../types";
import { parseOrgDate, startOfDay } from "./relative-date";

const DAY_MS = 24 * 60 * 60 * 1000;
export type AgendaMode = "day" | "week" | "month" | "year";

export interface AgendaSlot {
	date: Date;
	/** Blocks SCHEDULED on this date, plus blocks with DEADLINE within lead days. */
	blocks: ViewBlock[];
}

export interface AgendaRange {
	start: Date;
	end: Date;
	slots: AgendaSlot[];
}

export interface ComputeAgendaOptions {
	mode: AgendaMode;
	now?: Date;
	/** Days in advance a `DEADLINE:` chip starts surfacing on the agenda. */
	deadlineLeadDays?: number;
}

/**
 * Compute the visible agenda range for a given mode + anchor date and bin
 * blocks into per-day slots. The host renders the slots into its grid; this
 * helper does no rendering.
 *
 * Day mode: a single slot for `now`'s local day.
 * Week mode: 7 slots Sunday→Saturday containing `now`.
 * Month mode: 6 weeks × 7 days starting from the Sunday before the 1st.
 * Year mode: 365/366 slots from Jan 1 to Dec 31 of `now`'s year.
 */
export function computeAgenda(
	blocks: ViewBlock[],
	options: ComputeAgendaOptions,
): AgendaRange {
	const now = options.now ?? new Date();
	const leadDays = options.deadlineLeadDays ?? 7;
	const range = rangeForMode(options.mode, now);
	const slots: AgendaSlot[] = [];
	for (
		let cursor = range.start.getTime();
		cursor < range.end.getTime();
		cursor += DAY_MS
	) {
		slots.push({ date: new Date(cursor), blocks: [] });
	}
	for (const block of blocks) {
		distributeBlock(block, slots, leadDays);
	}
	return { start: range.start, end: range.end, slots };
}

function rangeForMode(
	mode: AgendaMode,
	anchor: Date,
): { start: Date; end: Date } {
	const today = startOfDay(anchor);
	if (mode === "day") {
		return { start: today, end: new Date(today.getTime() + DAY_MS) };
	}
	if (mode === "week") {
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() - today.getDay());
		const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
		return { start: weekStart, end: weekEnd };
	}
	if (mode === "year") {
		const start = new Date(today.getFullYear(), 0, 1);
		const end = new Date(today.getFullYear() + 1, 0, 1);
		return { start, end };
	}
	const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	const start = new Date(firstOfMonth);
	start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
	const end = new Date(start.getTime() + 42 * DAY_MS);
	return { start, end };
}

function distributeBlock(
	block: ViewBlock,
	slots: AgendaSlot[],
	leadDays: number,
): void {
	const scheduled = parseOrgDate(block.scheduled);
	const deadline = parseOrgDate(block.deadline);
	for (const slot of slots) {
		const slotMs = slot.date.getTime();
		const matchesScheduled =
			scheduled !== null && startOfDay(scheduled).getTime() === slotMs;
		const matchesDeadline =
			deadline !== null &&
			slotMs >= startOfDay(deadline).getTime() - leadDays * DAY_MS &&
			slotMs <= startOfDay(deadline).getTime();
		if (matchesScheduled || matchesDeadline) {
			slot.blocks.push(block);
		}
	}
}
