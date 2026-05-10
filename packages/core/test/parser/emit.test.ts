import { describe, expect, it } from "vitest";
import {
	emitAppendBlock,
	emitSetSchedule,
	emitSetTags,
	emitToggleTodo,
} from "../../src/parser/emit";
import { parseOrgTimestamp } from "../../src/parser/timestamp";

const SIMPLE_DOC = `* heading
:PROPERTIES:
:ID:       01J9
:END:
body
`;

describe("emitToggleTodo", () => {
	it("adds TODO to a heading without one", () => {
		const result = emitToggleTodo(SIMPLE_DOC, "01J9", "TODO");
		expect(result.startsWith("* TODO heading\n")).toBe(true);
	});

	it("changes TODO to DONE", () => {
		const doc = SIMPLE_DOC.replace("* heading", "* TODO heading");
		const result = emitToggleTodo(doc, "01J9", "DONE");
		expect(result.startsWith("* DONE heading\n")).toBe(true);
	});

	it("clears the keyword with target=null", () => {
		const doc = SIMPLE_DOC.replace("* heading", "* TODO heading");
		const result = emitToggleTodo(doc, "01J9", null);
		expect(result.startsWith("* heading\n")).toBe(true);
	});

	it("returns unchanged when blockId is missing", () => {
		expect(emitToggleTodo(SIMPLE_DOC, "missing", "DONE")).toBe(SIMPLE_DOC);
	});
});

describe("emitSetTags", () => {
	it("adds tags to a heading without any", () => {
		const result = emitSetTags(SIMPLE_DOC, "01J9", ["work", "ops"]);
		expect(result.startsWith("* heading :work:ops:\n")).toBe(true);
	});

	it("replaces existing tags", () => {
		const doc = SIMPLE_DOC.replace("* heading", "* heading :old:");
		const result = emitSetTags(doc, "01J9", ["new"]);
		expect(result.startsWith("* heading :new:\n")).toBe(true);
	});

	it("clears tags with empty array", () => {
		const doc = SIMPLE_DOC.replace("* heading", "* heading :old:");
		const result = emitSetTags(doc, "01J9", []);
		expect(result.startsWith("* heading\n")).toBe(true);
	});
});

describe("emitSetSchedule", () => {
	const ts = parseOrgTimestamp("<2026-05-07 Thu 09:00>");
	if (!ts) throw new Error("test fixture timestamp failed to parse");

	it("inserts a planning line where none exists", () => {
		const result = emitSetSchedule(SIMPLE_DOC, "01J9", ts);
		expect(result).toContain("SCHEDULED: <2026-05-07 Thu 09:00>");
		// Planning line lands after :END:, before body
		const idxEnd = result.indexOf(":END:\n") + ":END:\n".length;
		expect(result.slice(idxEnd, idxEnd + 11)).toBe("SCHEDULED: ");
	});

	it("replaces an existing SCHEDULED while preserving DEADLINE", () => {
		const doc = SIMPLE_DOC.replace(
			":END:\n",
			":END:\nSCHEDULED: <2026-01-01 Thu> DEADLINE: <2026-12-31 Thu>\n",
		);
		const newTs = parseOrgTimestamp("<2026-06-01 Mon>");
		if (!newTs) throw new Error("setup");
		const result = emitSetSchedule(doc, "01J9", newTs);
		expect(result).toContain("SCHEDULED: <2026-06-01 Mon>");
		expect(result).toContain("DEADLINE: <2026-12-31 Thu>");
		expect(result).not.toContain("SCHEDULED: <2026-01-01 Thu>");
	});

	it("removes planning line when ts=null and DEADLINE absent", () => {
		const doc = SIMPLE_DOC.replace(
			":END:\n",
			":END:\nSCHEDULED: <2026-01-01 Thu>\n",
		);
		const result = emitSetSchedule(doc, "01J9", null);
		expect(result).not.toContain("SCHEDULED:");
	});

	it("preserves DEADLINE on its own line when SCHEDULED is cleared", () => {
		const doc = SIMPLE_DOC.replace(
			":END:\n",
			":END:\nSCHEDULED: <2026-01-01 Thu> DEADLINE: <2026-12-31 Thu>\n",
		);
		const result = emitSetSchedule(doc, "01J9", null);
		expect(result).not.toContain("SCHEDULED:");
		expect(result).toContain("DEADLINE: <2026-12-31 Thu>");
	});
});

describe("emitAppendBlock", () => {
	it("appends to empty file", () => {
		const result = emitAppendBlock("", {
			level: 1,
			title: "first",
		});
		expect(result.startsWith("* first\n:PROPERTIES:\n:ID:       ")).toBe(true);
		expect(result).toContain(":END:\n");
	});

	it("appends to existing file with separating newline", () => {
		const result = emitAppendBlock("existing\nbody", {
			level: 1,
			title: "new",
		});
		expect(result.startsWith("existing\nbody\n* new\n")).toBe(true);
	});

	it("emits scheduled and deadline when provided", () => {
		const sched = parseOrgTimestamp("<2026-05-07 Thu>");
		const dead = parseOrgTimestamp("<2026-05-08 Fri>");
		if (!sched || !dead) throw new Error("setup");
		const result = emitAppendBlock("", {
			level: 2,
			todo: "TODO",
			priority: "A",
			title: "task",
			tags: ["work"],
			scheduled: sched,
			deadline: dead,
		});
		expect(result).toMatch(/^\*\* TODO \[#A\] task :work:\n/);
		expect(result).toContain(
			"SCHEDULED: <2026-05-07 Thu> DEADLINE: <2026-05-08 Fri>",
		);
	});

	it("ignores caller-supplied properties.ID and mints a fresh one", () => {
		const result = emitAppendBlock("", {
			level: 1,
			title: "x",
			properties: { ID: "should-be-ignored", FOO: "bar" },
		});
		expect(result).not.toContain("should-be-ignored");
		expect(result).toContain(":FOO: bar");
	});
});
