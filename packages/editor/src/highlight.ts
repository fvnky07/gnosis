import type { OrgProseToken, OrgProseTokenKind, OrgToken } from "./types";

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

/**
 * Live-preview-only tokens: heading-mark-N covers the `*+` stars plus the
 * trailing space, emphasis-*-mark covers the single delimiter char,
 * emphasis-*-body covers the content between delimiters, and link-* tokens
 * decompose `[[url][label]]` (or `[[url]]`) into bracket / url / label.
 *
 * Recognized emphasis follows Emacs' `org-emphasis-regexp-components`
 * defaults: a marker must be preceded by start-of-line or one of
 * `\s-('"{` and followed by end-of-line or one of `\s-.,:!?;'")}\[`, and
 * the body must not start or end with whitespace or `,"`. Up to one
 * newline inside the body is tolerated, which matches Emacs' default of
 * `org-emphasis-regexp-components`'s fifth component (`1`).
 */
const EMPHASIS_MARKERS: { char: string; kind: OrgProseTokenKind }[] = [
	{ char: "*", kind: "emphasis-bold-body" },
	{ char: "/", kind: "emphasis-italic-body" },
	{ char: "_", kind: "emphasis-underline-body" },
	{ char: "=", kind: "emphasis-verbatim-body" },
	{ char: "~", kind: "emphasis-code-body" },
	{ char: "+", kind: "emphasis-strike-body" },
];

const PRE = "(?:^|[\\s\\-('\"{])";
const POST = "(?=$|[\\s\\-.,:!?;'\")}\\[])";
// Body: starts and ends with a non-border char ([^\s,"]) and contains at
// most one newline. The non-greedy middle ([\s\S]*?) keeps the match
// minimal so multiple emphasis runs on the same line each match independently.
const BODY = '[^\\s,"](?:[^\\n]*?(?:\\n[^\\n]*?)?[^\\s,"])?';

const HEADING_RE = /^(\*+)( +)/gm;
const LINK_RE = /\[\[([^\]]+?)\](?:\[([^\]]+?)\])?\]/g;

export function findOrgProseTokens(text: string): OrgProseToken[] {
	const tokens: OrgProseToken[] = [];
	const headingRanges: [number, number][] = [];

	for (const m of text.matchAll(HEADING_RE)) {
		const idx = m.index ?? 0;
		const stars = m[1] ?? "";
		const space = m[2] ?? "";
		const level = Math.min(stars.length, 6);
		const start = idx;
		const end = idx + stars.length + space.length;
		tokens.push({
			kind: `heading-mark-${level}` as OrgProseTokenKind,
			start,
			end,
		});
		headingRanges.push([start, end]);
	}

	const insideHeadingStars = (pos: number): boolean => {
		for (const [hs, he] of headingRanges) {
			if (pos >= hs && pos < he) return true;
		}
		return false;
	};

	for (const { char, kind } of EMPHASIS_MARKERS) {
		const c = escapeForRegExp(char);
		const re = new RegExp(`${PRE}(${c})(${BODY}|[^\\s,"])(${c})${POST}`, "gm");
		for (const m of text.matchAll(re)) {
			const idx = m.index ?? 0;
			const preLen = m[0].length - (m[2]?.length ?? 0) - 2;
			const markStart = idx + preLen;
			// Skip emphasis runs whose opening marker collides with a heading's
			// star sequence (e.g. `***** foo` — the asterisks are the heading
			// stars, not bold delimiters).
			if (insideHeadingStars(markStart)) continue;
			const bodyStart = markStart + 1;
			const bodyEnd = bodyStart + (m[2]?.length ?? 0);
			const closeEnd = bodyEnd + 1;
			const markKind = kind.replace("-body", "-mark") as OrgProseTokenKind;
			tokens.push({ kind: markKind, start: markStart, end: bodyStart });
			tokens.push({ kind, start: bodyStart, end: bodyEnd });
			tokens.push({ kind: markKind, start: bodyEnd, end: closeEnd });
		}
	}

	for (const m of text.matchAll(LINK_RE)) {
		const idx = m.index ?? 0;
		const url = m[1] ?? "";
		const label = m[2];
		const total = m[0].length;
		// `[[`
		tokens.push({ kind: "link-bracket", start: idx, end: idx + 2 });
		const urlStart = idx + 2;
		const urlEnd = urlStart + url.length;
		tokens.push({ kind: "link-url", start: urlStart, end: urlEnd });
		if (label !== undefined) {
			// `][`
			tokens.push({ kind: "link-bracket", start: urlEnd, end: urlEnd + 2 });
			const labelStart = urlEnd + 2;
			const labelEnd = labelStart + label.length;
			tokens.push({ kind: "link-label", start: labelStart, end: labelEnd });
			// `]]`
			tokens.push({
				kind: "link-bracket",
				start: labelEnd,
				end: labelEnd + 2,
			});
		} else {
			// `]]`
			tokens.push({ kind: "link-bracket", start: urlEnd, end: idx + total });
		}
	}

	tokens.sort((a, b) => a.start - b.start || a.end - b.end);
	return tokens;
}

function escapeForRegExp(s: string): string {
	return s.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}

/** Classes attached to {@link OrgProseToken} bodies. Markers map to a
 *  single "hidden" class handled by the live-preview plugin itself. */
export const ORG_PROSE_BODY_CLASS: Partial<Record<OrgProseTokenKind, string>> =
	{
		"emphasis-bold-body": "cm-org-bold",
		"emphasis-italic-body": "cm-org-italic",
		"emphasis-underline-body": "cm-org-underline",
		"emphasis-verbatim-body": "cm-org-verbatim",
		"emphasis-code-body": "cm-org-code",
		"emphasis-strike-body": "cm-org-strike",
		"link-label": "cm-org-link",
		"link-url": "cm-org-link",
	};
