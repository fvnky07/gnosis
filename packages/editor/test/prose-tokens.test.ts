import { describe, expect, it } from "vitest";
import { findOrgProseTokens } from "../src/highlight";

describe("findOrgProseTokens — headings", () => {
	it("locates H1..H6 stars", () => {
		const text = "* a\n** b\n*** c\n**** d\n***** e\n****** f\n";
		const tokens = findOrgProseTokens(text);
		const headings = tokens.filter((t) => t.kind.startsWith("heading-mark-"));
		expect(headings.map((t) => t.kind)).toEqual([
			"heading-mark-1",
			"heading-mark-2",
			"heading-mark-3",
			"heading-mark-4",
			"heading-mark-5",
			"heading-mark-6",
		]);
	});

	it("includes the trailing space in the heading mark range", () => {
		const text = "** hello";
		const [h] = findOrgProseTokens(text);
		expect(h).toMatchObject({ kind: "heading-mark-2", start: 0, end: 3 });
		expect(text.slice(h?.start ?? 0, h?.end ?? 0)).toBe("** ");
	});

	it("caps levels above 6 at heading-mark-6", () => {
		const text = "******** deep heading\n";
		const tokens = findOrgProseTokens(text);
		const heading = tokens.find((t) => t.kind.startsWith("heading-mark-"));
		expect(heading?.kind).toBe("heading-mark-6");
	});

	it("does not match stars without a trailing space (not a heading)", () => {
		const text = "*bold*\n";
		const tokens = findOrgProseTokens(text);
		expect(
			tokens.find((t) => t.kind.startsWith("heading-mark-")),
		).toBeUndefined();
	});
});

describe("findOrgProseTokens — emphasis", () => {
	it("splits bold into mark/body/mark with correct ranges", () => {
		const text = "*bold*";
		const tokens = findOrgProseTokens(text);
		expect(tokens).toEqual([
			{ kind: "emphasis-bold-mark", start: 0, end: 1 },
			{ kind: "emphasis-bold-body", start: 1, end: 5 },
			{ kind: "emphasis-bold-mark", start: 5, end: 6 },
		]);
	});

	it("recognises every marker kind", () => {
		const text = "*b* /i/ _u_ =v= ~c~ +s+";
		const tokens = findOrgProseTokens(text);
		const bodies = tokens
			.filter((t) => t.kind.endsWith("-body"))
			.map((t) => t.kind);
		expect(bodies).toEqual([
			"emphasis-bold-body",
			"emphasis-italic-body",
			"emphasis-underline-body",
			"emphasis-verbatim-body",
			"emphasis-code-body",
			"emphasis-strike-body",
		]);
	});

	it("does not match /usr/bin/foo as italic (path-like)", () => {
		const text = "/usr/bin/foo";
		const tokens = findOrgProseTokens(text);
		expect(tokens.filter((t) => t.kind.endsWith("-body"))).toEqual([]);
	});

	it("does not match heading stars as bold", () => {
		const text = "* TODO buy milk";
		const tokens = findOrgProseTokens(text);
		// Heading mark is emitted but no bold tokens should appear.
		expect(tokens.find((t) => t.kind === "emphasis-bold-mark")).toBeUndefined();
	});

	it("matches emphasis after punctuation pre-char", () => {
		const text = "(*hello*)";
		const tokens = findOrgProseTokens(text);
		const body = tokens.find((t) => t.kind === "emphasis-bold-body");
		expect(body).toBeDefined();
		expect(text.slice(body?.start ?? 0, body?.end ?? 0)).toBe("hello");
	});

	it("rejects emphasis with whitespace at the edge of the body", () => {
		const text = "* foo *"; // leading space inside, should not match
		const tokens = findOrgProseTokens(text);
		expect(tokens.find((t) => t.kind.endsWith("-body"))).toBeUndefined();
	});
});

describe("findOrgProseTokens — links", () => {
	it("splits [[url][label]] into bracket/url/bracket/label/bracket", () => {
		const text = "[[https://example.com][example]]";
		const tokens = findOrgProseTokens(text);
		const kinds = tokens.map((t) => t.kind);
		expect(kinds).toEqual([
			"link-bracket",
			"link-url",
			"link-bracket",
			"link-label",
			"link-bracket",
		]);
	});

	it("splits bare [[url]] into bracket/url/bracket", () => {
		const text = "[[https://example.com]]";
		const tokens = findOrgProseTokens(text);
		expect(tokens.map((t) => t.kind)).toEqual([
			"link-bracket",
			"link-url",
			"link-bracket",
		]);
		const url = tokens[1];
		expect(text.slice(url?.start ?? 0, url?.end ?? 0)).toBe(
			"https://example.com",
		);
	});
});

describe("findOrgProseTokens — sorting", () => {
	it("returns tokens sorted by start offset", () => {
		const text = "* heading\n*bold* and /italic/ then [[u][l]] done";
		const tokens = findOrgProseTokens(text);
		for (let i = 1; i < tokens.length; i++) {
			const cur = tokens[i];
			const prev = tokens[i - 1];
			if (!cur || !prev) throw new Error("token gap");
			expect(cur.start).toBeGreaterThanOrEqual(prev.start);
		}
	});
});
