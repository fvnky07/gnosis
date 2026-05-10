import { describe, expect, it } from "vitest";
import {
	captureToVault,
	composeCaptureBlock,
	dailyNotePath,
	formatOrgDate,
	MemoryVault,
	parseTaskSchedule,
} from "../../src";

describe("dailyNotePath", () => {
	it("zero-pads month and day", () => {
		expect(dailyNotePath(new Date(2026, 0, 3))).toBe("daily/2026-01-03.org");
	});
});

describe("formatOrgDate", () => {
	it("emits an active org timestamp with weekday", () => {
		const ts = formatOrgDate(new Date(2026, 4, 10));
		expect(ts.raw).toBe("<2026-05-10 Sun>");
		expect(ts.active).toBe(true);
		expect(ts.date).toBe("2026-05-10");
	});

	it("supports inactive form", () => {
		expect(formatOrgDate(new Date(2026, 4, 10), false).raw).toBe(
			"[2026-05-10 Sun]",
		);
	});
});

describe("parseTaskSchedule", () => {
	const now = new Date(2026, 4, 10);

	it("strips trailing 'today'", () => {
		const r = parseTaskSchedule("buy milk today", now);
		expect(r.title).toBe("buy milk");
		expect(r.scheduled.date).toBe("2026-05-10");
	});

	it("schedules 'tomorrow' for next day", () => {
		const r = parseTaskSchedule("buy milk tomorrow", now);
		expect(r.title).toBe("buy milk");
		expect(r.scheduled.date).toBe("2026-05-11");
	});

	it("accepts an ISO date suffix", () => {
		const r = parseTaskSchedule("ship release 2026-06-01", now);
		expect(r.title).toBe("ship release");
		expect(r.scheduled.date).toBe("2026-06-01");
	});

	it("defaults to today when no keyword present", () => {
		const r = parseTaskSchedule("plain task", now);
		expect(r.title).toBe("plain task");
		expect(r.scheduled.date).toBe("2026-05-10");
	});
});

describe("composeCaptureBlock", () => {
	const now = new Date(2026, 4, 10);

	it("tags journal entries with :journal:", () => {
		const b = composeCaptureBlock("journal", "thoughts on the parser", now);
		expect(b.title).toBe("thoughts on the parser");
		expect(b.tags).toEqual(["journal"]);
		expect(b.todo).toBeUndefined();
	});

	it("emits a TODO with SCHEDULED for tasks", () => {
		const b = composeCaptureBlock("task", "buy milk tomorrow", now);
		expect(b.todo).toBe("TODO");
		expect(b.title).toBe("buy milk");
		expect(b.scheduled?.date).toBe("2026-05-11");
	});

	it("emits a bare heading for notes", () => {
		const b = composeCaptureBlock("note", "untagged note", now);
		expect(b.title).toBe("untagged note");
		expect(b.tags).toBeUndefined();
		expect(b.todo).toBeUndefined();
	});
});

describe("captureToVault", () => {
	const now = new Date(2026, 4, 10);

	it("creates the daily file on first capture", async () => {
		const vault = new MemoryVault();
		const r = await captureToVault(vault, "journal", "first entry", now);
		expect(r.fileCreated).toBe(true);
		expect(r.filePath).toBe("daily/2026-05-10.org");
		const written = await vault.read("daily/2026-05-10.org");
		expect(written).toContain("#+TITLE: 2026-05-10");
		expect(written).toContain("* first entry :journal:");
		expect(written).toContain(":ID:");
	});

	it("appends to an existing daily file", async () => {
		const vault = new MemoryVault();
		await vault.write(
			"daily/2026-05-10.org",
			"#+TITLE: 2026-05-10\n* existing :journal:\n:PROPERTIES:\n:ID:       01J000EXISTS01\n:END:\n",
		);
		await captureToVault(vault, "task", "buy milk tomorrow", now);
		const written = await vault.read("daily/2026-05-10.org");
		expect(written).toContain("* existing :journal:");
		expect(written).toContain("* TODO buy milk");
		expect(written).toContain("SCHEDULED: <2026-05-11 Mon>");
	});
});
