import type { ViewBlock } from "../types";

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const TIME_RANGE_RE = /(\d{2}:\d{2})-(\d{2}:\d{2})/;
const TIME_RE = /(\d{2}:\d{2})/;
const MULTI_DAY_RE = /<(\d{4}-\d{2}-\d{2})[^>]*>--<(\d{4}-\d{2}-\d{2})[^>]*>/;

const DEFAULT_DURATION_MIN = 60;

export interface ParsedOrgTimestamp {
	startISO: string;
	endISO: string;
	allDay: boolean;
}

/**
 * Parse an org timestamp into Schedule-X-format ISO strings. Returns null for
 * unparseable input. Handles the four shapes documented in planning/10-views.md:
 *   <2026-05-10>              date-only, all-day
 *   <2026-05-10 Sun 14:00>    timed; default 60-minute duration when no end
 *   <2026-05-10 Sun 10:00-14:00>  timed range
 *   <2026-05-10>--<2026-05-12>    multi-day all-day span
 * Day-name tokens (`Sun`, `Mon`, …) are ignored.
 */
export function parseOrgTimestamp(
	raw: string | null | undefined,
): ParsedOrgTimestamp | null {
	if (!raw) return null;
	const multi = MULTI_DAY_RE.exec(raw);
	if (multi) {
		return {
			startISO: multi[1] as string,
			endISO: multi[2] as string,
			allDay: true,
		};
	}
	const dateMatch = DATE_RE.exec(raw);
	if (!dateMatch) return null;
	const dateISO = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
	const range = TIME_RANGE_RE.exec(raw);
	if (range) {
		return {
			startISO: `${dateISO} ${range[1]}`,
			endISO: `${dateISO} ${range[2]}`,
			allDay: false,
		};
	}
	const single = TIME_RE.exec(raw);
	if (single) {
		const startISO = `${dateISO} ${single[1]}`;
		const endISO = addMinutes(startISO, DEFAULT_DURATION_MIN);
		return { startISO, endISO, allDay: false };
	}
	return { startISO: dateISO, endISO: dateISO, allDay: true };
}

function addMinutes(startISO: string, minutes: number): string {
	const [datePart, timePart] = startISO.split(" ");
	const dateBits = (datePart ?? "").split("-").map(Number);
	const timeBits = (timePart ?? "00:00").split(":").map(Number);
	const d = new Date(
		dateBits[0] ?? 0,
		(dateBits[1] ?? 1) - 1,
		dateBits[2] ?? 1,
		timeBits[0] ?? 0,
		(timeBits[1] ?? 0) + minutes,
	);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const mi = String(d.getMinutes()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/**
 * Schedule-X event payload (subset of `CalendarEventExternal`). The `_block`
 * field is a custom passthrough Schedule-X tolerates on event objects — it
 * lets `AgendaCalendar`'s click handler recover the source ViewBlock.
 */
export interface ScheduleXEvent {
	id: string;
	title: string;
	start: string;
	end: string;
	calendarId?: string;
	_block: ViewBlock;
}

/**
 * Map ViewBlocks to Schedule-X events. SCHEDULED produces a primary event;
 * a DEADLINE-only block (no SCHEDULED) produces a synthetic all-day event
 * tagged `calendarId: "deadline"` so the host can theme deadline events
 * differently. Blocks with neither scheduled nor deadline are skipped.
 */
export function viewBlocksToScheduleXEvents(
	blocks: ViewBlock[],
): ScheduleXEvent[] {
	const out: ScheduleXEvent[] = [];
	for (const block of blocks) {
		if (block.scheduled) {
			const parsed = parseOrgTimestamp(block.scheduled);
			if (parsed) {
				out.push({
					id: block.id,
					title: stripStars(block.headlineRaw),
					start: parsed.startISO,
					end: parsed.endISO,
					_block: block,
				});
				continue;
			}
		}
		if (block.deadline) {
			const parsed = parseOrgTimestamp(block.deadline);
			if (parsed) {
				out.push({
					id: block.id,
					title: stripStars(block.headlineRaw),
					start: parsed.startISO,
					end: parsed.endISO,
					calendarId: "deadline",
					_block: block,
				});
			}
		}
	}
	return out;
}

function stripStars(headlineRaw: string): string {
	return headlineRaw.replace(/^\*+\s+/, "");
}
