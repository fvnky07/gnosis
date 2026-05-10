import { ulid } from "ulid";
import { parse } from "./parse";
import { parsePlanningLine } from "./planning";
import { parsePropertiesDrawer } from "./properties";
import type { Block, NewBlock, OrgTimestamp, TodoState } from "./types";

// groups: 1 = stars + leading whitespace,
//         2 = keyword + its trailing whitespace (undefined if absent),
//         3 = the keyword's trailing whitespace alone (preserved on rewrite
//             so a tab between TODO and the title isn't normalized to a
//             single space — see PR #2 review feedback for the round-trip
//             argument), 4 = the rest of the heading (title + tags).
const HEADING_DECOMPOSE_RE = /^(\*+\s+)((?:TODO|DONE)(\s*))?(.*)$/;
// Tag chars include Unicode letters / digits via `\p{L}\p{N}` (with `u`
// flag) so headings like `:買い物:` and `:работа:` round-trip correctly.
const TRAILING_TAGS_MATCH_RE = /(\s+)(:(?:[\p{L}\p{N}_@#%]+:)+)(\s*)$/u;

/**
 * Splice-based mutation: rewrite the TODO keyword on a single heading.
 * Passing `target = null` removes the keyword entirely.
 *
 * Returns the unchanged input if no block with `blockId` is found, so the
 * indexer can call this safely without a pre-flight existence check.
 */
export function emitToggleTodo(
	rawText: string,
	blockId: string,
	target: TodoState | null,
): string {
	const block = findBlock(rawText, blockId);
	if (!block) return rawText;
	const headingLine = getHeadingLineRange(rawText, block.rangeInFile.start);
	const original = rawText.slice(headingLine.start, headingLine.end);
	const match = HEADING_DECOMPOSE_RE.exec(original);
	if (!match) return rawText;
	const [, starsAndSpace, keywordWithSpace, keywordTrailingWs = "", rest] =
		match;
	if (starsAndSpace === undefined || rest === undefined) return rawText;

	let updated: string;
	if (target === null) {
		if (!keywordWithSpace) return rawText;
		updated = `${starsAndSpace}${rest}`;
	} else if (keywordWithSpace) {
		// Replace just the keyword token; preserve the original trailing
		// whitespace (tab vs single space vs multi-space) verbatim.
		updated = `${starsAndSpace}${target}${keywordTrailingWs}${rest}`;
	} else {
		// No keyword present — insert one. Add a single separating space
		// only when there is title text after the keyword.
		const sep = rest.length > 0 ? " " : "";
		updated = `${starsAndSpace}${target}${sep}${rest}`;
	}
	if (updated === original) return rawText;
	return spliceLine(rawText, headingLine, updated);
}

/**
 * Splice-based mutation: rewrite the trailing `:tag1:tag2:` list on a single
 * heading. Pass `[]` to clear tags. The list is written in the order given.
 */
export function emitSetTags(
	rawText: string,
	blockId: string,
	tags: string[],
): string {
	const block = findBlock(rawText, blockId);
	if (!block) return rawText;
	const headingLine = getHeadingLineRange(rawText, block.rangeInFile.start);
	const original = rawText.slice(headingLine.start, headingLine.end);

	const tagMatch = TRAILING_TAGS_MATCH_RE.exec(original);
	let updated: string;

	if (tagMatch) {
		// Existing tag list found — splice replace just that region. Preserve
		// any trailing whitespace that lived AFTER the tag list verbatim so
		// repeated edits don't drift.
		const fullMatchLength = tagMatch[0].length;
		const matchStart = original.length - fullMatchLength;
		const beforeTags = original.slice(0, matchStart);
		const leadingWs = tagMatch[1];
		const trailingWs = tagMatch[3];
		if (tags.length === 0) {
			updated = `${beforeTags}${trailingWs}`;
		} else {
			updated = `${beforeTags}${leadingWs}:${tags.join(":")}:${trailingWs}`;
		}
	} else {
		// No existing tags. Clearing tags is a no-op; never touch whitespace
		// that the user typed for some other reason.
		if (tags.length === 0) return rawText;
		const trailingWsMatch = /\s+$/.exec(original);
		const trailing = trailingWsMatch ? trailingWsMatch[0] : "";
		const trimmed = trailing
			? original.slice(0, original.length - trailing.length)
			: original;
		updated = `${trimmed} :${tags.join(":")}:${trailing}`;
	}

	if (updated === original) return rawText;
	return spliceLine(rawText, headingLine, updated);
}

/**
 * Splice-based mutation: replace the SCHEDULED timestamp on a block. If the
 * planning line is absent, one is inserted (immediately after the properties
 * drawer if present, else immediately after the heading line). Existing
 * DEADLINE on the same line is preserved.
 *
 * Pass `ts = null` to remove SCHEDULED. If both SCHEDULED and DEADLINE were
 * present, the DEADLINE is preserved on its own line; if SCHEDULED was the
 * only entry, the planning line is removed entirely.
 */
export function emitSetSchedule(
	rawText: string,
	blockId: string,
	ts: OrgTimestamp | null,
): string {
	const block = findBlock(rawText, blockId);
	if (!block) return rawText;
	const headingLineEnd = rawText.indexOf("\n", block.rangeInFile.start);
	if (headingLineEnd === -1) return rawText;
	const sectionBodyStart = headingLineEnd + 1;
	const sectionEnd = block.rangeInFile.end;
	const section = rawText.slice(sectionBodyStart, sectionEnd);

	const props = parsePropertiesDrawer(section);
	const afterDrawerStart = props.drawerStart === -1 ? 0 : props.drawerEnd;
	const planning = parsePlanningLine(section.slice(afterDrawerStart));

	if (planning.lineStart !== -1) {
		const absStart = sectionBodyStart + afterDrawerStart + planning.lineStart;
		const absEnd = sectionBodyStart + afterDrawerStart + planning.lineEnd;
		if (ts === null && !planning.deadline && !planning.closed) {
			// Nothing left worth keeping on the planning line.
			return rawText.slice(0, absStart) + rawText.slice(absEnd);
		}
		const parts: string[] = [];
		if (ts !== null) parts.push(`SCHEDULED: ${ts.raw}`);
		if (planning.deadline) parts.push(`DEADLINE: ${planning.deadline.raw}`);
		// Preserve a `CLOSED:` token if the user has logged a completion
		// time — otherwise updating SCHEDULED would silently lose the log
		// entry. See PR #2 review for the round-trip argument.
		if (planning.closed) parts.push(`CLOSED: ${planning.closed.raw}`);
		const replacement = `${parts.join(" ")}\n`;
		return rawText.slice(0, absStart) + replacement + rawText.slice(absEnd);
	}

	if (ts === null) return rawText;
	const insertAt = sectionBodyStart + afterDrawerStart;
	const newLine = `SCHEDULED: ${ts.raw}\n`;
	return rawText.slice(0, insertAt) + newLine + rawText.slice(insertAt);
}

/**
 * Append a new heading + properties drawer + planning line + body to the end
 * of `rawText`. A fresh ULID is minted for the block's `:ID:` property. The
 * input is preserved verbatim; a separating newline is inserted if needed.
 */
export function emitAppendBlock(rawText: string, block: NewBlock): string {
	const id = ulid();
	const stars = "*".repeat(Math.max(1, block.level));
	const todoSegment = block.todo ? `${block.todo} ` : "";
	const prioritySegment = block.priority ? `[#${block.priority}] ` : "";
	const tagSegment =
		block.tags && block.tags.length > 0 ? ` :${block.tags.join(":")}:` : "";
	const headingLine = `${stars} ${todoSegment}${prioritySegment}${block.title}${tagSegment}\n`;

	const propsLines: string[] = [":PROPERTIES:", `:ID:       ${id}`];
	if (block.properties) {
		for (const [key, value] of Object.entries(block.properties)) {
			if (key === "ID") continue;
			propsLines.push(`:${key}: ${value}`);
		}
	}
	propsLines.push(":END:");
	const propsBlock = `${propsLines.join("\n")}\n`;

	const planningParts: string[] = [];
	if (block.scheduled) planningParts.push(`SCHEDULED: ${block.scheduled.raw}`);
	if (block.deadline) planningParts.push(`DEADLINE: ${block.deadline.raw}`);
	const planningLine =
		planningParts.length > 0 ? `${planningParts.join(" ")}\n` : "";

	const body = block.body ?? "";

	const prefix =
		rawText.length === 0 || rawText.endsWith("\n") ? rawText : `${rawText}\n`;

	return `${prefix}${headingLine}${propsBlock}${planningLine}${body}`;
}

interface LineRange {
	start: number;
	end: number;
}

function findBlock(rawText: string, blockId: string): Block | null {
	const result = parse(rawText, "");
	return result.document.blocks.find((b) => b.id === blockId) ?? null;
}

function getHeadingLineRange(rawText: string, blockStart: number): LineRange {
	const newlineIdx = rawText.indexOf("\n", blockStart);
	return {
		start: blockStart,
		end: newlineIdx === -1 ? rawText.length : newlineIdx,
	};
}

function spliceLine(
	rawText: string,
	range: LineRange,
	replacement: string,
): string {
	return rawText.slice(0, range.start) + replacement + rawText.slice(range.end);
}
