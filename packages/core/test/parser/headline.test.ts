import { describe, expect, it } from "vitest";
import { parseHeadline } from "../../src/parser/headline";

describe("parseHeadline", () => {
	it("parses level only", () => {
		expect(parseHeadline("* Hello")).toEqual({
			level: 1,
			title: "Hello",
			tags: [],
		});
	});

	it("parses level + TODO", () => {
		expect(parseHeadline("** TODO buy milk")).toEqual({
			level: 2,
			todo: "TODO",
			title: "buy milk",
			tags: [],
		});
	});

	it("parses level + DONE", () => {
		expect(parseHeadline("* DONE finished")).toEqual({
			level: 1,
			todo: "DONE",
			title: "finished",
			tags: [],
		});
	});

	it("parses level + TODO + priority + title", () => {
		expect(parseHeadline("* TODO [#A] Critical bug")).toEqual({
			level: 1,
			todo: "TODO",
			priority: "A",
			title: "Critical bug",
			tags: [],
		});
	});

	it("parses tags only", () => {
		expect(parseHeadline("* Title :work:project:")).toEqual({
			level: 1,
			title: "Title",
			tags: ["work", "project"],
		});
	});

	it("parses level + TODO + priority + title + tags", () => {
		expect(parseHeadline("** DONE [#B] Ship release :ops:release:")).toEqual({
			level: 2,
			todo: "DONE",
			priority: "B",
			title: "Ship release",
			tags: ["ops", "release"],
		});
	});

	it("rejects non-heading lines", () => {
		expect(parseHeadline("not a heading")).toBeNull();
		expect(parseHeadline("*nospace")).toBeNull();
		expect(parseHeadline("")).toBeNull();
	});

	it("supports many star levels", () => {
		expect(parseHeadline("****** Deep")).toMatchObject({
			level: 6,
			title: "Deep",
		});
	});

	it("treats lone TODO/DONE as keyword without title", () => {
		const result = parseHeadline("* TODO");
		expect(result?.todo).toBe("TODO");
		expect(result?.title).toBe("");
	});

	it("preserves brackets in title that aren't priorities", () => {
		expect(parseHeadline("* TODO [tag] in title")).toMatchObject({
			todo: "TODO",
			title: "[tag] in title",
		});
	});

	it("does not treat mid-line :foo: as a tag list", () => {
		expect(parseHeadline("* :embedded: title text")).toMatchObject({
			level: 1,
			title: ":embedded: title text",
			tags: [],
		});
	});
});
