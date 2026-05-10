import type { OrgToken } from "./types";

/**
 * Pure-logic token finder used by the CodeMirror decoration plugin. Returns
 * a flat list of {@link OrgToken}s covering everything the MVP highlighter
 * cares about: TODO keywords, priority cookies, trailing tags, timestamps,
 * `:PROPERTIES:`/`:END:` markers, and `#+...` file keywords.
 *
 * The regexes are intentionally minimal — the planning doc accepts that
 * markdown highlighting plus this layer is a placeholder for a real Lezer
 * grammar (issue E1). Edge cases are documented inline.
 */
export function findOrgTokens(text: string): OrgToken[] {
	const tokens: OrgToken[] = [];

	const TODO_RE = /^(\*+ )(TODO|DONE)\b/gm;
	for (const m of text.matchAll(TODO_RE)) {
		const idx = m.index ?? 0;
		const stars = m[1];
		const keyword = m[2];
		if (stars === undefined || keyword === undefined) continue;
		tokens.push({
			kind: "todo-keyword",
			start: idx + stars.length,
			end: idx + stars.length + keyword.length,
		});
	}

	const PRIORITY_RE = /\[#[ABC]\]/g;
	for (const m of text.matchAll(PRIORITY_RE)) {
		const idx = m.index ?? 0;
		tokens.push({ kind: "priority", start: idx, end: idx + m[0].length });
	}

	// Trailing tags on heading lines only: a line beginning with `*+ ` that ends
	// with a `:tag1:tag2:` cluster (allowing trailing whitespace).
	const HEADING_TAG_RE = /^(\*+ .*?)(\s+:(?:[A-Za-z0-9_@#%]+:)+)\s*$/gm;
	for (const m of text.matchAll(HEADING_TAG_RE)) {
		const idx = m.index ?? 0;
		const headPart = m[1];
		const tagsWithLead = m[2];
		if (headPart === undefined || tagsWithLead === undefined) continue;
		const leadingSpace = tagsWithLead.length - tagsWithLead.trimStart().length;
		const tagStart = idx + headPart.length + leadingSpace;
		const tagEnd = tagStart + tagsWithLead.trimStart().length;
		tokens.push({ kind: "tag", start: tagStart, end: tagEnd });
	}

	const ACTIVE_TS_RE = /<\d{4}-\d{2}-\d{2}[^>\n]*>/g;
	for (const m of text.matchAll(ACTIVE_TS_RE)) {
		const idx = m.index ?? 0;
		tokens.push({
			kind: "timestamp-active",
			start: idx,
			end: idx + m[0].length,
		});
	}

	const INACTIVE_TS_RE = /\[\d{4}-\d{2}-\d{2}[^\]\n]*\]/g;
	for (const m of text.matchAll(INACTIVE_TS_RE)) {
		const idx = m.index ?? 0;
		tokens.push({
			kind: "timestamp-inactive",
			start: idx,
			end: idx + m[0].length,
		});
	}

	const DRAWER_RE = /^:(PROPERTIES|END):$/gm;
	for (const m of text.matchAll(DRAWER_RE)) {
		const idx = m.index ?? 0;
		tokens.push({ kind: "drawer-marker", start: idx, end: idx + m[0].length });
	}

	const FILE_KEYWORD_RE = /^#\+[A-Za-z][A-Za-z0-9_-]*:/gm;
	for (const m of text.matchAll(FILE_KEYWORD_RE)) {
		const idx = m.index ?? 0;
		tokens.push({ kind: "file-keyword", start: idx, end: idx + m[0].length });
	}

	tokens.sort((a, b) => a.start - b.start || a.end - b.end);
	return tokens;
}

/** CSS class names used by the decoration plugin and {@link BlockSnippet}. */
export const ORG_TOKEN_CLASS: Record<OrgToken["kind"], string> = {
	"todo-keyword": "cm-gnosis-todo",
	priority: "cm-gnosis-priority",
	tag: "cm-gnosis-tag",
	"timestamp-active": "cm-gnosis-ts-active",
	"timestamp-inactive": "cm-gnosis-ts-inactive",
	"drawer-marker": "cm-gnosis-drawer",
	"file-keyword": "cm-gnosis-keyword",
};
