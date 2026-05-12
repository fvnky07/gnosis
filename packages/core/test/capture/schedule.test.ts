import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildOrgTimestamp,
	captureScheduledToVault,
	composeScheduledCapture,
	MemoryVault,
} from "../../src";
import { _resetCrossDayWarn } from "../../src/capture/schedule";

describe("buildOrgTimestamp", () => {
	it("emits an active date-only timestamp by default", () => {
		const ts = buildOrgTimestamp(new Date(2026, 4, 15));
		expect(ts.raw).toBe("<2026-05-15 Fri>");
		expect(ts.active).toBe(true);
		expect(ts.date).toBe("2026-05-15");
		expect(ts.time).toBeUndefined();
	});

	it("includes HH:MM when withTime is true", () => {
		const ts = buildOrgTimestamp(new Date(2026, 4, 15, 15, 30), {
			withTime: true,
		});
		expect(ts.raw).toBe("<2026-05-15 Fri 15:30>");
		expect(ts.time).toBe("15:30");
	});

	it("zero-pads single-digit hour and minute", () => {
		const ts = buildOrgTimestamp(new Date(2026, 4, 15, 9, 5), {
			withTime: true,
		});
		expect(ts.raw).toBe("<2026-05-15 Fri 09:05>");
	});

	it("emits inactive form when active=false", () => {
		const ts = buildOrgTimestamp(new Date(2026, 4, 11, 9, 24), {
			withTime: true,
			active: false,
		});
		expect(ts.raw).toBe("[2026-05-11 Mon 09:24]");
		expect(ts.active).toBe(false);
	});
});

describe("composeScheduledCapture", () => {
	const createdAt = new Date(2026, 4, 11, 9, 24);

	it("targets the picked date's daily note", () => {
		const r = composeScheduledCapture({
			title: "Buy milk",
			scheduledAt: { date: new Date(2026, 4, 15, 15, 30), allDay: false },
			createdAt,
			todayDailyPath: "daily/2026-05-11.org",
		});
		expect(r.filePath).toBe("daily/2026-05-15.org");
	});

	it("emits a TODO block with timed SCHEDULED + provenance properties", () => {
		const r = composeScheduledCapture({
			title: "Buy milk",
			scheduledAt: { date: new Date(2026, 4, 15, 15, 30), allDay: false },
			createdAt,
			todayDailyPath: "daily/2026-05-11.org",
		});
		expect(r.block.todo).toBe("TODO");
		expect(r.block.title).toBe("Buy milk");
		expect(r.block.scheduled?.raw).toBe("<2026-05-15 Fri 15:30>");
		expect(r.block.properties?.CREATED).toBe("[2026-05-11 Mon 09:24]");
		expect(r.block.properties?.CREATED_FROM).toBe("daily/2026-05-11.org");
	});

	it("drops HH:MM from SCHEDULED when allDay is true", () => {
		const r = composeScheduledCapture({
			title: "Conference",
			scheduledAt: { date: new Date(2026, 4, 15, 15, 30), allDay: true },
			createdAt,
		});
		expect(r.block.scheduled?.raw).toBe("<2026-05-15 Fri>");
		expect(r.block.scheduled?.time).toBeUndefined();
	});

	it("omits CREATED_FROM when no todayDailyPath given", () => {
		const r = composeScheduledCapture({
			title: "x",
			scheduledAt: { date: new Date(2026, 4, 15), allDay: true },
			createdAt,
		});
		expect(r.block.properties?.CREATED).toBeDefined();
		expect(r.block.properties?.CREATED_FROM).toBeUndefined();
	});

	it("trims whitespace from the title", () => {
		const r = composeScheduledCapture({
			title: "   spaced out   ",
			scheduledAt: { date: new Date(2026, 4, 15), allDay: true },
			createdAt,
		});
		expect(r.block.title).toBe("spaced out");
	});

	it("forwards optional priority + tags + body", () => {
		const r = composeScheduledCapture({
			title: "Ship release",
			scheduledAt: { date: new Date(2026, 4, 15, 9, 0), allDay: false },
			createdAt,
			priority: "A",
			tags: ["work", "release"],
			body: "details on next line\n",
		});
		expect(r.block.priority).toBe("A");
		expect(r.block.tags).toEqual(["work", "release"]);
		expect(r.block.body).toBe("details on next line\n");
	});
});

describe("captureScheduledToVault", () => {
	const createdAt = new Date(2026, 4, 11, 9, 24);

	it("creates the picked daily file on first capture", async () => {
		const vault = new MemoryVault();
		const r = await captureScheduledToVault(vault, {
			title: "Buy milk",
			scheduledAt: { date: new Date(2026, 4, 15, 15, 30), allDay: false },
			createdAt,
			todayDailyPath: "daily/2026-05-11.org",
		});
		expect(r.fileCreated).toBe(true);
		expect(r.filePath).toBe("daily/2026-05-15.org");

		const written = await vault.read("daily/2026-05-15.org");
		expect(written).toContain("#+TITLE: 2026-05-15");
		expect(written).toContain("* TODO Buy milk");
		expect(written).toContain("SCHEDULED: <2026-05-15 Fri 15:30>");
		expect(written).toContain(":CREATED: [2026-05-11 Mon 09:24]");
		expect(written).toContain(":CREATED_FROM: daily/2026-05-11.org");
		expect(written).toContain(":ID:");
	});

	it("appends to an existing daily file without disturbing prior content", async () => {
		const vault = new MemoryVault();
		await vault.write(
			"daily/2026-05-15.org",
			"#+TITLE: 2026-05-15\n* existing :journal:\n:PROPERTIES:\n:ID:       01J000EXISTS01\n:END:\n",
		);
		const r = await captureScheduledToVault(vault, {
			title: "Buy milk",
			scheduledAt: { date: new Date(2026, 4, 15, 15, 30), allDay: false },
			createdAt,
			todayDailyPath: "daily/2026-05-11.org",
		});
		expect(r.fileCreated).toBe(false);

		const written = await vault.read("daily/2026-05-15.org");
		expect(written).toContain("* existing :journal:");
		expect(written).toContain("* TODO Buy milk");
		expect(written).toContain("SCHEDULED: <2026-05-15 Fri 15:30>");
	});

	it("writes an all-day SCHEDULED line when allDay is true", async () => {
		const vault = new MemoryVault();
		await captureScheduledToVault(vault, {
			title: "Conference",
			scheduledAt: { date: new Date(2026, 4, 20), allDay: true },
			createdAt,
		});
		const written = await vault.read("daily/2026-05-20.org");
		expect(written).toContain("SCHEDULED: <2026-05-20 Wed>");
		expect(written).not.toMatch(/SCHEDULED: <2026-05-20 Wed \d{2}:\d{2}>/);
	});
});

describe("composeScheduledCapture (endDate)", () => {
	const createdAt = new Date(2026, 4, 11, 9, 24);

	beforeEach(() => {
		_resetCrossDayWarn();
	});

	it("emits a HH:MM-HH:MM range when endDate falls on the same day", () => {
		const r = composeScheduledCapture({
			title: "Standup",
			scheduledAt: {
				date: new Date(2026, 4, 15, 9, 0),
				endDate: new Date(2026, 4, 15, 10, 0),
				allDay: false,
			},
			createdAt,
		});
		expect(r.block.scheduled?.raw).toBe("<2026-05-15 Fri 09:00-10:00>");
		expect(r.block.scheduled?.endTime).toBe("10:00");
	});

	it("ignores endDate when allDay is true", () => {
		const r = composeScheduledCapture({
			title: "Conference",
			scheduledAt: {
				date: new Date(2026, 4, 15),
				endDate: new Date(2026, 4, 15, 23, 59),
				allDay: true,
			},
			createdAt,
		});
		expect(r.block.scheduled?.raw).toBe("<2026-05-15 Fri>");
		expect(r.block.scheduled?.endTime).toBeUndefined();
	});

	it("drops a cross-day endDate and warns once", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const a = composeScheduledCapture({
				title: "Trip",
				scheduledAt: {
					date: new Date(2026, 4, 15, 9, 0),
					endDate: new Date(2026, 4, 16, 9, 0),
					allDay: false,
				},
				createdAt,
			});
			const b = composeScheduledCapture({
				title: "Other trip",
				scheduledAt: {
					date: new Date(2026, 4, 18, 9, 0),
					endDate: new Date(2026, 4, 19, 9, 0),
					allDay: false,
				},
				createdAt,
			});
			expect(a.block.scheduled?.raw).toBe("<2026-05-15 Fri 09:00>");
			expect(a.block.scheduled?.endTime).toBeUndefined();
			expect(b.block.scheduled?.raw).toBe("<2026-05-18 Mon 09:00>");
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining("cross-day endDate"),
			);
		} finally {
			warn.mockRestore();
		}
	});

	it("treats endDate=null the same as omitted", () => {
		const r = composeScheduledCapture({
			title: "Single",
			scheduledAt: {
				date: new Date(2026, 4, 15, 9, 0),
				endDate: null,
				allDay: false,
			},
			createdAt,
		});
		expect(r.block.scheduled?.raw).toBe("<2026-05-15 Fri 09:00>");
		expect(r.block.scheduled?.endTime).toBeUndefined();
	});
});

describe("captureScheduledToVault (endDate)", () => {
	const createdAt = new Date(2026, 4, 11, 9, 24);

	beforeEach(() => {
		_resetCrossDayWarn();
	});

	afterEach(() => {
		_resetCrossDayWarn();
	});

	it("writes a range SCHEDULED line when endDate is supplied same day", async () => {
		const vault = new MemoryVault();
		await captureScheduledToVault(vault, {
			title: "Standup",
			scheduledAt: {
				date: new Date(2026, 4, 15, 9, 0),
				endDate: new Date(2026, 4, 15, 10, 0),
				allDay: false,
			},
			createdAt,
		});
		const written = await vault.read("daily/2026-05-15.org");
		expect(written).toContain("SCHEDULED: <2026-05-15 Fri 09:00-10:00>");
	});
});
