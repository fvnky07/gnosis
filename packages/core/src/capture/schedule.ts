/**
 * Scheduled capture: turns a "title + picked datetime" pair from the
 * desktop's Schedule dialog into a TODO block appended to the picked
 * date's daily note (`daily/<picked>.org`), creating the file if needed.
 *
 * Distinct from {@link captureToVault} (which always writes to TODAY's
 * daily note based on a CaptureKind text fragment) — this helper is for
 * the dedicated date-time capture surface that lets the user pick any
 * future date+time.
 *
 * The block records its capture provenance via `:CREATED:` (inactive
 * timestamp at wall-clock now) and `:CREATED_FROM:` (relative path of
 * today's daily note) properties so future cleanup tools can trace back
 * where any given block originated.
 */

import { emitAppendBlock } from "../parser/emit";
import type { NewBlock, OrgTimestamp } from "../parser/types";
import type { Vault } from "../vault";
import { VaultNotFoundError } from "../vault";
import { dailyNotePath } from "./index";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/**
 * Format a JS `Date` as an org timestamp. When `withTime` is true the
 * `HH:MM` segment is included. `active = true` produces `<...>` (the
 * agenda-visible variant); `false` produces `[...]` (used for the
 * `:CREATED:` property so it doesn't pollute the agenda).
 */
export function buildOrgTimestamp(
	date: Date,
	options: { withTime?: boolean; active?: boolean } = {},
): OrgTimestamp {
	const { withTime = false, active = true } = options;
	const yyyy = date.getFullYear();
	const mm = pad2(date.getMonth() + 1);
	const dd = pad2(date.getDate());
	const wk = WEEKDAY_NAMES[date.getDay()] ?? "Sun";
	const open = active ? "<" : "[";
	const close = active ? ">" : "]";
	const dateStr = `${yyyy}-${mm}-${dd}`;
	if (!withTime) {
		return { raw: `${open}${dateStr} ${wk}${close}`, active, date: dateStr };
	}
	const hh = pad2(date.getHours());
	const mi = pad2(date.getMinutes());
	const time = `${hh}:${mi}`;
	return {
		raw: `${open}${dateStr} ${wk} ${time}${close}`,
		active,
		date: dateStr,
		time,
	};
}

export interface ScheduledCaptureInput {
	/** Heading text (without leading TODO keyword or stars). */
	title: string;
	/** Picked moment + whether the user opted into a time component. */
	scheduledAt: { date: Date; allDay: boolean };
	/** Wall-clock now, for the `:CREATED:` property. */
	createdAt?: Date;
	/**
	 * Relative path of today's daily note for `:CREATED_FROM:`. If omitted
	 * the property is skipped (lets unit tests opt out of provenance).
	 */
	todayDailyPath?: string;
	/** Optional follow-up body lines under the heading. */
	body?: string;
	/** Optional priority cookie. */
	priority?: "A" | "B" | "C";
	/** Optional tag list (rendered as `:tag1:tag2:`). */
	tags?: string[];
}

export interface ScheduledCaptureBlock {
	/** Path of the file the block lives in (`daily/<picked>.org`). */
	filePath: string;
	/** {@link NewBlock} ready for {@link emitAppendBlock}. */
	block: NewBlock;
}

/**
 * Pure builder. Returns the daily-note path for the picked date plus a
 * fully-populated {@link NewBlock}; the caller is responsible for reading
 * the existing file (or creating an empty one) and passing the block to
 * {@link emitAppendBlock}.
 */
export function composeScheduledCapture(
	input: ScheduledCaptureInput,
): ScheduledCaptureBlock {
	const createdAt = input.createdAt ?? new Date();
	const filePath = dailyNotePath(input.scheduledAt.date);

	const properties: Record<string, string> = {
		// Inactive timestamp so the agenda doesn't surface the capture moment.
		CREATED: buildOrgTimestamp(createdAt, { withTime: true, active: false })
			.raw,
	};
	if (input.todayDailyPath) {
		properties.CREATED_FROM = input.todayDailyPath;
	}

	const scheduled = buildOrgTimestamp(input.scheduledAt.date, {
		withTime: !input.scheduledAt.allDay,
		active: true,
	});

	const block: NewBlock = {
		level: 1,
		todo: "TODO",
		title: input.title.trim(),
		scheduled,
		properties,
	};
	if (input.priority) block.priority = input.priority;
	if (input.tags && input.tags.length > 0) block.tags = input.tags;
	if (input.body) block.body = input.body;

	return { filePath, block };
}

export interface ScheduledCaptureResult {
	filePath: string;
	fileCreated: boolean;
}

/**
 * Side-effect counterpart to {@link composeScheduledCapture}. Reads (or
 * creates) the picked date's daily note, splices the new block at the end
 * via {@link emitAppendBlock}, and writes back. Mirrors {@link captureToVault}
 * but never touches today's file.
 */
export async function captureScheduledToVault(
	vault: Vault,
	input: ScheduledCaptureInput,
): Promise<ScheduledCaptureResult> {
	const { filePath, block } = composeScheduledCapture(input);
	await vault.ensureDir("daily");
	let original = "";
	let fileCreated = false;
	try {
		original = await vault.read(filePath);
	} catch (err) {
		if (!(err instanceof VaultNotFoundError)) throw err;
		fileCreated = true;
		const picked = input.scheduledAt.date;
		const yyyy = picked.getFullYear();
		const mm = pad2(picked.getMonth() + 1);
		const dd = pad2(picked.getDate());
		original = `#+TITLE: ${yyyy}-${mm}-${dd}\n`;
	}
	const updated = emitAppendBlock(original, block);
	await vault.write(filePath, updated);
	return { filePath, fileCreated };
}
