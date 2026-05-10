import { parseOrgTimestamp } from "./timestamp";
import type { OrgTimestamp } from "./types";

const PLANNING_KEYWORD_PREFIX_RE = /^\s*(SCHEDULED|DEADLINE|CLOSED):/;
const PLANNING_PAIR_RE = /(SCHEDULED|DEADLINE|CLOSED):\s*([<[][^>\]]*[>\]])/g;

export interface PlanningParseResult {
	scheduled?: OrgTimestamp;
	deadline?: OrgTimestamp;
	/**
	 * `CLOSED:` is parsed for round-trip preservation but not stored on the
	 * Document model. Splice emitters carry it through when rewriting the
	 * planning line so a TODO log entry isn't lost when SCHEDULED changes.
	 */
	closed?: OrgTimestamp;
	/** Byte offset of the planning line start. -1 if absent. */
	lineStart: number;
	/** Byte offset just AFTER the planning line (including its newline). -1 if absent. */
	lineEnd: number;
}

/**
 * Parse a planning line at the start of `text`, allowing leading blank lines.
 * A planning line contains one or more of `SCHEDULED:`, `DEADLINE:`, and
 * `CLOSED:` followed by org timestamps, all on a single line. `CLOSED:` is
 * recognized for round-trip-safe skipping but not stored in MVP.
 *
 * Returns absent (`lineStart === -1`) when the first non-blank line does not
 * begin with one of those keywords.
 */
export function parsePlanningLine(text: string): PlanningParseResult {
	let cursor = 0;
	while (cursor < text.length) {
		const lineEnd = text.indexOf("\n", cursor);
		const line =
			lineEnd === -1 ? text.slice(cursor) : text.slice(cursor, lineEnd);
		if (line.trim() === "") {
			if (lineEnd === -1) return { lineStart: -1, lineEnd: -1 };
			cursor = lineEnd + 1;
			continue;
		}
		if (!PLANNING_KEYWORD_PREFIX_RE.test(line)) {
			return { lineStart: -1, lineEnd: -1 };
		}
		const lineStart = cursor;
		const finalLineEnd = lineEnd === -1 ? cursor + line.length : lineEnd + 1;
		const result: PlanningParseResult = { lineStart, lineEnd: finalLineEnd };
		PLANNING_PAIR_RE.lastIndex = 0;
		let m: RegExpExecArray | null = PLANNING_PAIR_RE.exec(line);
		while (m !== null) {
			const [, keyword, raw] = m;
			const ts = parseOrgTimestamp(raw);
			if (ts) {
				if (keyword === "SCHEDULED") result.scheduled = ts;
				else if (keyword === "DEADLINE") result.deadline = ts;
				else if (keyword === "CLOSED") result.closed = ts;
			}
			m = PLANNING_PAIR_RE.exec(line);
		}
		return result;
	}
	return { lineStart: -1, lineEnd: -1 };
}
