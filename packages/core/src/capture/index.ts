/**
 * Capture pipeline: turns a palette text fragment into an `emitAppendBlock`
 * call against today's daily note. Matches the MVP user-flow in
 * `planning/01-overview-and-mvp.md`:
 *
 *   `j thoughts on the parser`  → `* ... :journal:`
 *   `t buy milk tomorrow`       → `* TODO buy milk` + SCHEDULED tomorrow
 *   `n untagged note`           → `* untagged note`
 *
 * Pure functions live alongside the {@link captureToVault} side effect so
 * tests can exercise composition (date parsing, daily-note path) without a
 * real vault.
 */

import { emitAppendBlock } from "../parser/emit";
import type { NewBlock, OrgTimestamp } from "../parser/types";
import type { Vault } from "../vault";
import { VaultNotFoundError } from "../vault";

export type CaptureKind = "journal" | "task" | "note";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/** `daily/YYYY-MM-DD.org` per `planning/04-vault-and-indexer.md`. */
export function dailyNotePath(date: Date): string {
	return `daily/${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.org`;
}

/** Format a JS `Date` as an org active timestamp (`<YYYY-MM-DD Wkd>`). */
export function formatOrgDate(date: Date, active = true): OrgTimestamp {
	const yyyy = date.getFullYear();
	const mm = pad2(date.getMonth() + 1);
	const dd = pad2(date.getDate());
	const wk = WEEKDAY_NAMES[date.getDay()] ?? "Sun";
	const open = active ? "<" : "[";
	const close = active ? ">" : "]";
	return {
		raw: `${open}${yyyy}-${mm}-${dd} ${wk}${close}`,
		active,
		date: `${yyyy}-${mm}-${dd}`,
	};
}

interface ParsedSchedule {
	title: string;
	scheduled: OrgTimestamp;
}

/**
 * Strip a trailing schedule keyword (`today`, `tomorrow`, ISO date) from
 * `text` and return the cleaned title plus the resolved timestamp. Falls
 * back to scheduling on `now` when nothing matches.
 *
 * Uses token splitting instead of `(.*)` regexes to avoid polynomial
 * backtracking (ReDoS) on inputs with many repeated spaces.
 *
 * When the entire input is a bare keyword/date (no title prefix), the
 * original text is kept as the title so the caller never produces an
 * empty heading.
 */
export function parseTaskSchedule(text: string, now: Date): ParsedSchedule {
	const trimmed = text.trim();

	// Split on any run of whitespace so there is no ambiguous overlap
	// between the "body" and the trailing keyword that could cause ReDoS.
	const tokens = trimmed.split(/\s+/);
	const lastToken = tokens[tokens.length - 1] ?? "";
	const prefix = tokens.slice(0, -1).join(" ");

	if (/^today$/i.test(lastToken)) {
		// If prefix is empty the user typed only the keyword; keep the
		// original text rather than producing an empty title.
		return {
			title: prefix || trimmed,
			scheduled: formatOrgDate(now),
		};
	}

	if (/^tomorrow$/i.test(lastToken)) {
		const t = new Date(now);
		t.setDate(t.getDate() + 1);
		return {
			title: prefix || trimmed,
			scheduled: formatOrgDate(t),
		};
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(lastToken)) {
		const [y, m, d] = lastToken.split("-").map(Number) as [
			number,
			number,
			number,
		];
		if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
			const constructed = new Date(y, m - 1, d);
			// Validate that the JS Date didn't silently normalize an
			// out-of-range value (e.g. Feb 31 → Mar 3, month 13 → next year).
			if (
				constructed.getFullYear() === y &&
				constructed.getMonth() === m - 1 &&
				constructed.getDate() === d
			) {
				return {
					title: prefix || trimmed,
					scheduled: formatOrgDate(constructed),
				};
			}
		}
	}

	return { title: trimmed, scheduled: formatOrgDate(now) };
}

/** Build the {@link NewBlock} that {@link emitAppendBlock} will splice into the file. */
export function composeCaptureBlock(
	kind: CaptureKind,
	text: string,
	now: Date = new Date(),
): NewBlock {
	switch (kind) {
		case "journal":
			return { level: 1, title: text.trim(), tags: ["journal"] };
		case "task": {
			const { title, scheduled } = parseTaskSchedule(text, now);
			return { level: 1, todo: "TODO", title, scheduled };
		}
		case "note":
			return { level: 1, title: text.trim() };
	}
}

export interface CaptureResult {
	filePath: string;
	fileCreated: boolean;
}

/**
 * Append a captured block to today's daily note. Creates the daily file
 * (and `daily/` directory) if missing. The indexer is _not_ invoked here —
 * the host wires that on top so tests can verify capture without a store.
 */
export async function captureToVault(
	vault: Vault,
	kind: CaptureKind,
	text: string,
	now: Date = new Date(),
): Promise<CaptureResult> {
	const filePath = dailyNotePath(now);
	await vault.ensureDir("daily");
	const block = composeCaptureBlock(kind, text, now);
	let original = "";
	let fileCreated = false;
	try {
		original = await vault.read(filePath);
	} catch (err) {
		if (!(err instanceof VaultNotFoundError)) throw err;
		fileCreated = true;
		const yyyy = now.getFullYear();
		const mm = pad2(now.getMonth() + 1);
		const dd = pad2(now.getDate());
		original = `#+TITLE: ${yyyy}-${mm}-${dd}\n`;
	}
	const updated = emitAppendBlock(original, block);
	await vault.write(filePath, updated);
	return { filePath, fileCreated };
}
