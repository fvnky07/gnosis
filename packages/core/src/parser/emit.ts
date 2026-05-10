import { ulid } from "ulid";
import { parse } from "./parse";
import { parsePlanningLine } from "./planning";
import { parsePropertiesDrawer } from "./properties";
import type { Block, NewBlock, OrgTimestamp, TodoState } from "./types";

const HEADING_DECOMPOSE_RE = /^(\*+\s+)(TODO\s+|DONE\s+)?(.*)$/;
const TRAILING_TAGS_RE = /\s+:(?:[A-Za-z0-9_@#%]+:)+\s*$/;

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
	const [, starsAndSpace, , rest] = match;
	const updated =
		target === null
			? `${starsAndSpace}${rest}`
			: `${starsAndSpace}${target} ${rest}`;
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
	const stripped = original.replace(TRAILING_TAGS_RE, "").trimEnd();
	const updated =
		tags.length === 0 ? stripped : `${stripped} :${tags.join(":")}:`;
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
		if (ts === null && !planning.deadline) {
			return rawText.slice(0, absStart) + rawText.slice(absEnd);
		}
		const parts: string[] = [];
		if (ts !== null) parts.push(`SCHEDULED: ${ts.raw}`);
		if (planning.deadline) parts.push(`DEADLINE: ${planning.deadline.raw}`);
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
