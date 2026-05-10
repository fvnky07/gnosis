import { ulid } from "ulid";
import { parse } from "./parse";
import { parsePropertiesDrawer } from "./properties";

export interface MintIdsResult {
	newText: string;
	mintedCount: number;
}

/**
 * Walk the file and splice a fresh ULID `:ID:` property into every heading
 * that lacks one. If the heading already has a `:PROPERTIES:` drawer, the
 * `:ID:` line is inserted just after `:PROPERTIES:`. Otherwise a new drawer
 * is created on the line below the heading.
 *
 * Headings already carrying an `:ID:` are left byte-identical — the rule of
 * round-trip safety per `planning/05-org-parser.md` requires this.
 *
 * Implementation note: blocks are processed in reverse order so each splice
 * happens at or after every not-yet-processed block's heading line, keeping
 * the original parse-time byte offsets valid for the remaining work.
 */
export function mintIds(rawText: string): MintIdsResult {
	const parseResult = parse(rawText, "");
	let newText = rawText;
	let mintedCount = 0;

	for (let i = parseResult.document.blocks.length - 1; i >= 0; i--) {
		const block = parseResult.document.blocks[i];
		if (!block) continue;
		if (block.id !== "") continue;

		const headingLineEnd = newText.indexOf("\n", block.rangeInFile.start);
		if (headingLineEnd === -1) continue;
		const insertPoint = headingLineEnd + 1;

		const sectionBodyEnd = block.rangeInFile.end;
		const sectionBody = newText.slice(insertPoint, sectionBodyEnd);
		const propsResult = parsePropertiesDrawer(sectionBody);

		const newId = ulid();

		if (propsResult.drawerStart !== -1) {
			const drawerHeaderStart = insertPoint + propsResult.drawerStart;
			const drawerHeaderLineEnd = newText.indexOf("\n", drawerHeaderStart);
			if (drawerHeaderLineEnd === -1) continue;
			const idLine = `:ID:       ${newId}\n`;
			newText =
				newText.slice(0, drawerHeaderLineEnd + 1) +
				idLine +
				newText.slice(drawerHeaderLineEnd + 1);
		} else {
			const drawer = `:PROPERTIES:\n:ID:       ${newId}\n:END:\n`;
			newText =
				newText.slice(0, insertPoint) + drawer + newText.slice(insertPoint);
		}
		mintedCount++;
	}

	return { newText, mintedCount };
}
