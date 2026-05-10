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

const ISO_DATE_RE = /^(.*)\s+(\d{4}-\d{2}-\d{2})$/;
const TODAY_RE = /^(.*)\s+today$/i;
const TOMORROW_RE = /^(.*)\s+tomorrow$/i;

/**
 * Strip a trailing schedule keyword (`today`, `tomorrow`, ISO date) from
 * `text` and return the cleaned title plus the resolved timestamp. Falls
 * back to scheduling on `now` when nothing matches.
 */
export function parseTaskSchedule(text: string, now: Date): ParsedSchedule {
	const trimmed = text.trim();
	const today = TODAY_RE.exec(trimmed);
	if (today?.[1]) {
		return { title: today[1].trim(), scheduled: formatOrgDate(now) };
	}
	const tomorrow = TOMORROW_RE.exec(trimmed);
	if (tomorrow?.[1]) {
		const t = new Date(now);
		t.setDate(t.getDate() + 1);
		return { title: tomorrow[1].trim(), scheduled: formatOrgDate(t) };
	}
	const iso = ISO_DATE_RE.exec(trimmed);
	if (iso?.[1] && iso[2]) {
		const [y, m, d] = iso[2].split("-").map(Number);
		if (
			y !== undefined &&
			m !== undefined &&
			d !== undefined &&
			!Number.isNaN(y) &&
			!Number.isNaN(m) &&
			!Number.isNaN(d)
		) {
			return {
				title: iso[1].trim(),
				scheduled: formatOrgDate(new Date(y, m - 1, d)),
			};
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
	} catch {
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
