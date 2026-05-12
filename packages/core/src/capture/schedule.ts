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
import { buildOrgTimestamp } from "../parser/timestamp";
import type { NewBlock } from "../parser/types";
import type { Vault } from "../vault";
import { VaultNotFoundError } from "../vault";
import { dailyNotePath } from "./index";

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function isSameLocalDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

let warnedCrossDayEnd = false;

export interface ScheduledCaptureInput {
	/** Heading text (without leading TODO keyword or stars). */
	title: string;
	/**
	 * Picked moment + whether the user opted into a time component, plus
	 * an optional end-of-range time. `endDate` only contributes a time
	 * range when it falls on the same calendar day as `date` and `allDay`
	 * is false — cross-day spans (`<...>--<...>`) are deferred and the
	 * mismatched `endDate` is silently dropped (with a one-shot warn).
	 */
	scheduledAt: { date: Date; endDate?: Date | null; allDay: boolean };
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

	const endDate = input.scheduledAt.endDate ?? undefined;
	let endTime: string | undefined;
	if (endDate && !input.scheduledAt.allDay) {
		if (isSameLocalDay(input.scheduledAt.date, endDate)) {
			endTime = `${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`;
		} else if (!warnedCrossDayEnd) {
			warnedCrossDayEnd = true;
			// Multi-day spans require the `<start>--<end>` org form. The
			// builder + emitter don't ship that yet, so the end is dropped
			// and a single-shot warn is logged for visibility.
			console.warn(
				"[capture/schedule] cross-day endDate dropped — multi-day SCHEDULED ranges are not yet supported",
			);
		}
	}

	const scheduled = buildOrgTimestamp(input.scheduledAt.date, {
		withTime: !input.scheduledAt.allDay,
		active: true,
		endTime,
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

/**
 * Internal test hook: resets the one-shot cross-day warn so unit tests can
 * assert that the warning fires exactly once per process. Not exported
 * through the package barrel — only used by `test/capture/schedule.test.ts`.
 */
export function _resetCrossDayWarn(): void {
	warnedCrossDayEnd = false;
}
