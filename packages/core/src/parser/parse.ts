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
		const lineText = trimTrailingNewline(rawText.slice(lineStart, lineEnd));
		if (HEADING_RE.test(lineText)) {
			headingLineIndices.push(i);
		}
	}

	const preambleEnd =
		headingLineIndices.length > 0
			? lineStarts[headingLineIndices[0]]
			: rawText.length;
	const preamble = rawText.slice(0, preambleEnd);
	const fileKeywords = parseFileKeywords(preamble);

	const blocks: Block[] = [];
	const localTagsPerBlock: string[][] = [];

	for (let h = 0; h < headingLineIndices.length; h++) {
		const headingLineIdx = headingLineIndices[h];
		const sectionStart = lineStarts[headingLineIdx];
		const sectionEnd =
			h + 1 < headingLineIndices.length
				? lineStarts[headingLineIndices[h + 1]]
				: rawText.length;

		const headingLineEnd = lineStarts[headingLineIdx + 1];
		const headingLineText = trimTrailingNewline(
			rawText.slice(sectionStart, headingLineEnd),
		);
		const parsedHeadline = parseHeadline(headingLineText);
		if (!parsedHeadline) continue;

		const sectionBody = rawText.slice(headingLineEnd, sectionEnd);

		const propsResult = parsePropertiesDrawer(sectionBody);
		for (const w of propsResult.warnings) warnings.push(w);

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
		while (
			ancestors.length > 0 &&
			ancestors[ancestors.length - 1].level >= block.level
		) {
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
