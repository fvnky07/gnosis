import type { ViewBlock } from "../types";

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const TIME_RANGE_RE = /(\d{2}:\d{2})-(\d{2}:\d{2})/;
const TIME_RE = /(\d{2}:\d{2})/;
const MULTI_DAY_SPLIT = /^(.*?)>--<(.*)$/;

const DEFAULT_DURATION_MIN = 60;
const TODO_STATE_RE =
	/^(?:TODO|DONE|NEXT|WAIT|WAITING|DOING|CANCELLED|HOLD)\s+/;

export interface ParsedOrgTimestamp {
	startISO: string;
	endISO: string;
	allDay: boolean;
}

interface ParsedEndpoint {
	dateISO: string;
	startTime: string | null;
	endTime: string | null;
}

/**
 * Parse an org timestamp into Schedule-X-format ISO strings. Returns null for
 * unparseable input. Handles the four shapes documented in planning/10-views.md
 * (plus timed-multi-day variants):
 *   <2026-05-10>                            date-only, all-day
 *   <2026-05-10 Sun 14:00>                  timed; default 60-minute duration when no end
 *   <2026-05-10 Sun 10:00-14:00>            timed range
 *   <2026-05-10>--<2026-05-12>              multi-day all-day span
 *   <2026-05-10 09:00>--<2026-05-12 17:00>  multi-day timed span
 * Day-name tokens (`Sun`, `Mon`, …) are ignored.
 */
export function parseOrgTimestamp(
	raw: string | null | undefined,
): ParsedOrgTimestamp | null {
	if (!raw) return null;
	const stripped = raw.replace(/[<>]/g, "");
	const split = MULTI_DAY_SPLIT.exec(raw);
	if (split) {
		const left = parseEndpoint(split[1] ?? "");
		const right = parseEndpoint(split[2] ?? "");
		if (!left || !right) return null;
		const startTimed = left.startTime !== null;
		const endTimed = right.endTime !== null || right.startTime !== null;
		if (startTimed || endTimed) {
			const startISO = left.startTime
				? `${left.dateISO} ${left.startTime}`
				: `${left.dateISO} 00:00`;
			const endTime = right.endTime ?? right.startTime ?? "23:59";
			return {
				startISO,
				endISO: `${right.dateISO} ${endTime}`,
				allDay: false,
			};
		}
		return {
			startISO: left.dateISO,
			endISO: right.dateISO,
			allDay: true,
		};
	}
	const single = parseEndpoint(stripped);
	if (!single) return null;
	if (single.startTime && single.endTime) {
		return {
			startISO: `${single.dateISO} ${single.startTime}`,
			endISO: `${single.dateISO} ${single.endTime}`,
			allDay: false,
		};
	}
	if (single.startTime) {
		const startISO = `${single.dateISO} ${single.startTime}`;
		const endISO = addMinutes(startISO, DEFAULT_DURATION_MIN);
		return { startISO, endISO, allDay: false };
	}
	return {
		startISO: single.dateISO,
		endISO: single.dateISO,
		allDay: true,
	};
}

function parseEndpoint(body: string): ParsedEndpoint | null {
	const cleaned = body.replace(/[<>]/g, "");
	const dateMatch = DATE_RE.exec(cleaned);
	if (!dateMatch) return null;
	const dateISO = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
	const range = TIME_RANGE_RE.exec(cleaned);
	if (range) {
		return { dateISO, startTime: range[1] ?? null, endTime: range[2] ?? null };
	}
	const time = TIME_RE.exec(cleaned);
	if (time) {
		return { dateISO, startTime: time[1] ?? null, endTime: null };
	}
	return { dateISO, startTime: null, endTime: null };
}

function addMinutes(startISO: string, minutes: number): string {
	const [datePart, timePart] = startISO.split(" ");
	const dateBits = (datePart ?? "").split("-").map(Number);
	const timeBits = (timePart ?? "00:00").split(":").map(Number);
	if (dateBits.length !== 3 || dateBits.some(Number.isNaN)) return startISO;
	if (timeBits.length !== 2 || timeBits.some(Number.isNaN)) return startISO;
	const d = new Date(
		dateBits[0] as number,
		(dateBits[1] as number) - 1,
		dateBits[2] as number,
		timeBits[0] as number,
		(timeBits[1] as number) + minutes,
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
 * a DEADLINE-only block (no SCHEDULED) produces a synthetic event tagged
 * `calendarId: "deadline"` so the host can theme deadline events via the
 * Schedule-X `calendars` config. Blocks with neither scheduled nor deadline
 * are skipped.
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
					title: titleFor(block),
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
					title: titleFor(block),
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

function titleFor(block: ViewBlock): string {
	const noStars = block.headlineRaw.replace(/^\*+\s+/, "");
	return noStars.replace(TODO_STATE_RE, "");
}
