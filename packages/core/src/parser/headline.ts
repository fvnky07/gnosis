import type { ParsedHeadline, Priority, TodoState } from "./types";

const HEADING_RE = /^(\*+)\s+(.*)$/;
// Tag chars: any letter/number (Unicode) plus `_@#%`. The Unicode property
// classes catch Japanese, Cyrillic, Greek, etc. — the `u` flag activates them.
const TRAILING_TAGS_RE = /\s+(:(?:[\p{L}\p{N}_@#%]+:)+)\s*$/u;
const PRIORITY_RE = /^\[#([A-C])\]$/;

/**
 * Parse a single heading line into its constituent pieces. Returns `null`
 * when the line is not a heading (no leading stars + space). The body of
 * the headline (text between TODO/priority and trailing tags) is preserved
 * with internal whitespace collapsed to single spaces.
 *
 * Supported syntax:
 * - `*` to `******` for level 1..6 (any N permitted)
 * - Optional `TODO` or `DONE` keyword right after the stars
 * - Optional `[#A]`/`[#B]`/`[#C]` priority cookie
 * - Optional trailing `:tag1:tag2:` tag list (whitespace-separated from title)
 */
export function parseHeadline(line: string): ParsedHeadline | null {
	const headingMatch = HEADING_RE.exec(line);
	if (!headingMatch) return null;
	const level = headingMatch[1].length;
	let rest = headingMatch[2];

	// Strip trailing tags first so the title doesn't accidentally include them.
	let tags: string[] = [];
	const tagMatch = TRAILING_TAGS_RE.exec(rest);
	if (tagMatch) {
		tags = tagMatch[1]
			.split(":")
			.filter(Boolean)
			.map((t) => t.toLowerCase());
		rest = rest.slice(0, tagMatch.index);
	}

	rest = rest.trim();
	const tokens = rest.length > 0 ? rest.split(/\s+/) : [];
	let cursor = 0;
	let todo: TodoState | undefined;
	let priority: Priority | undefined;

	if (tokens[cursor] === "TODO" || tokens[cursor] === "DONE") {
		todo = tokens[cursor] as TodoState;
		cursor++;
	}
	const priCandidate = tokens[cursor];
	if (priCandidate) {
		const priMatch = PRIORITY_RE.exec(priCandidate);
		if (priMatch) {
			priority = priMatch[1] as Priority;
			cursor++;
		}
	}
	const title = tokens.slice(cursor).join(" ");

	return { level, todo, priority, title, tags };
}
