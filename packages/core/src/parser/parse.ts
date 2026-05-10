import { parseFileKeywords } from "./file-keywords";
import { parseHeadline } from "./headline";
import { parsePlanningLine } from "./planning";
import { parsePropertiesDrawer } from "./properties";
import type {
	Block,
	ByteRange,
	Document,
	ParseResult,
	ParseWarning,
} from "./types";

const HEADING_RE = /^\*+\s/;

/**
 * Parse a raw org file into a {@link Document} with metadata and a flat list
 * of {@link Block}s. Round-trip safety is preserved by storing the original
 * text in `document.raw` and per-block `rangeInFile` byte offsets — emit
 * functions splice into raw, never re-emit from the AST.
 *
 * Heading depth is a number on each block; views derive children on demand.
 * Tag inheritance is denormalized: each block's `tags` is the effective set
 * (file tags ∪ ancestor heading tags ∪ local heading tags), so views never
 * have to reconstruct the hierarchy.
 *
 * IDs come from the `:ID:` property when present; otherwise `block.id` is
 * the empty string and the indexer is expected to call {@link mintIds} to
 * splice ULIDs into the file before re-parsing.
 */
export function parse(rawText: string, sourcePath: string): ParseResult {
	const warnings: ParseWarning[] = [];
	const lineStarts = buildLineStarts(rawText);

	const headingLineIndices: number[] = [];
	for (let i = 0; i < lineStarts.length - 1; i++) {
		const lineStart = lineStarts[i];
		const lineEnd = lineStarts[i + 1];
		if (lineStart === undefined || lineEnd === undefined) continue;
		const lineText = trimTrailingNewline(rawText.slice(lineStart, lineEnd));
		if (HEADING_RE.test(lineText)) {
			headingLineIndices.push(i);
		}
	}

	const firstHeadingLineIdx = headingLineIndices[0];
	const preambleEnd =
		firstHeadingLineIdx !== undefined
			? (lineStarts[firstHeadingLineIdx] ?? rawText.length)
			: rawText.length;
	const preamble = rawText.slice(0, preambleEnd);
	const fileKeywords = parseFileKeywords(preamble);

	const blocks: Block[] = [];
	const localTagsPerBlock: string[][] = [];

	for (let h = 0; h < headingLineIndices.length; h++) {
		const headingLineIdx = headingLineIndices[h];
		if (headingLineIdx === undefined) continue;
		const sectionStart = lineStarts[headingLineIdx];
		if (sectionStart === undefined) continue;
		let sectionEnd: number;
		if (h + 1 < headingLineIndices.length) {
			const nextHeadingLineIdx = headingLineIndices[h + 1];
			if (nextHeadingLineIdx === undefined) continue;
			const candidate = lineStarts[nextHeadingLineIdx];
			if (candidate === undefined) continue;
			sectionEnd = candidate;
		} else {
			sectionEnd = rawText.length;
		}

		const headingLineEnd = lineStarts[headingLineIdx + 1];
		if (headingLineEnd === undefined) continue;
		const headingLineText = trimTrailingNewline(
			rawText.slice(sectionStart, headingLineEnd),
		);
		const parsedHeadline = parseHeadline(headingLineText);
		if (!parsedHeadline) continue;

		const sectionBody = rawText.slice(headingLineEnd, sectionEnd);

		const propsResult = parsePropertiesDrawer(sectionBody);
		// `parsePropertiesDrawer` returns warnings whose `range` is relative
		// to its input (`sectionBody`). Translate to absolute offsets in the
		// full file so callers and UIs can highlight the right spot.
		for (const w of propsResult.warnings) {
			warnings.push(translateWarning(w, headingLineEnd));
		}

		const afterDrawerStart =
			propsResult.drawerStart === -1 ? 0 : propsResult.drawerEnd;
		const afterDrawer = sectionBody.slice(afterDrawerStart);
		const planResult = parsePlanningLine(afterDrawer);

		const stripRangesList: ByteRange[] = [];
		if (propsResult.drawerStart !== -1) {
			stripRangesList.push({
				start: propsResult.drawerStart,
				end: propsResult.drawerEnd,
			});
		}
		if (planResult.lineStart !== -1) {
			stripRangesList.push({
				start: afterDrawerStart + planResult.lineStart,
				end: afterDrawerStart + planResult.lineEnd,
			});
		}
		const body = stripRanges(sectionBody, stripRangesList);

		const id = propsResult.properties.ID ?? "";

		const block: Block = {
			id,
			level: parsedHeadline.level,
			title: parsedHeadline.title,
			tags: [],
			properties: propsResult.properties,
			body,
			rangeInFile: { start: sectionStart, end: sectionEnd },
		};
		if (parsedHeadline.todo) block.todo = parsedHeadline.todo;
		if (parsedHeadline.priority) block.priority = parsedHeadline.priority;
		if (planResult.scheduled) block.scheduled = planResult.scheduled;
		if (planResult.deadline) block.deadline = planResult.deadline;

		blocks.push(block);
		localTagsPerBlock.push([...parsedHeadline.tags]);
	}

	applyTagInheritance(blocks, localTagsPerBlock, fileKeywords.fileTags);

	const document: Document = {
		path: sourcePath,
		fileTags: fileKeywords.fileTags,
		preamble,
		blocks,
		raw: rawText,
	};
	if (fileKeywords.title !== undefined) document.title = fileKeywords.title;

	return { document, warnings };
}

function buildLineStarts(text: string): number[] {
	const offsets: number[] = [0];
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 10 /* \n */) {
			offsets.push(i + 1);
		}
	}
	if (offsets[offsets.length - 1] !== text.length) {
		offsets.push(text.length);
	}
	return offsets;
}

function trimTrailingNewline(s: string): string {
	if (s.length === 0) return s;
	if (s.charCodeAt(s.length - 1) === 10) return s.slice(0, -1);
	return s;
}

function stripRanges(text: string, ranges: ByteRange[]): string {
	if (ranges.length === 0) return text;
	const sorted = [...ranges].sort((a, b) => a.start - b.start);
	let result = "";
	let cursor = 0;
	for (const r of sorted) {
		if (r.start > cursor) result += text.slice(cursor, r.start);
		cursor = Math.max(cursor, r.end);
	}
	if (cursor < text.length) result += text.slice(cursor);
	return result;
}

function translateWarning(warning: ParseWarning, offset: number): ParseWarning {
	if (!warning.range) return warning;
	return {
		...warning,
		range: {
			start: warning.range.start + offset,
			end: warning.range.end + offset,
		},
	};
}

/**
 * Walk the flat block list and compute each block's effective tag set as
 * `fileTags ∪ ancestor.localTags ∪ block.localTags`. Mutates `block.tags`
 * in place.
 */
function applyTagInheritance(
	blocks: Block[],
	localTagsPerBlock: string[][],
	fileTags: string[],
): void {
	const ancestors: { level: number; localTags: string[] }[] = [];
	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		const localTags = localTagsPerBlock[i];
		// `noUncheckedIndexedAccess` makes both lookups string|undefined; in
		// practice they're always defined since we walk a parallel index
		// established a few lines above.
		if (!block || !localTags) continue;
		while (ancestors.length > 0) {
			const top = ancestors[ancestors.length - 1];
			if (!top || top.level < block.level) break;
			ancestors.pop();
		}
		const effective = new Set<string>(fileTags);
		for (const ancestor of ancestors) {
			for (const t of ancestor.localTags) effective.add(t);
		}
		for (const t of localTags) effective.add(t);
		block.tags = Array.from(effective);
		ancestors.push({ level: block.level, localTags });
	}
}
