import { describe, expect, it } from "bun:test";
import { parseNaturalSchedule } from "./parse-natural-schedule";

// Reference: Wed 2026-05-13 09:00 local. All `forwardDate` resolutions are
// computed relative to this anchor so the fixtures stay deterministic.
const REF = new Date(2026, 4, 13, 9, 0);

describe("parseNaturalSchedule", () => {
	it("extracts trailing temporal phrase and returns the rest as title", () => {
		const r = parseNaturalSchedule("Buy milk tomorrow at 3pm", REF);
		expect(r.title).toBe("Buy milk");
		expect(r.start?.getFullYear()).toBe(2026);
		expect(r.start?.getMonth()).toBe(4);
		expect(r.start?.getDate()).toBe(14);
		expect(r.start?.getHours()).toBe(15);
		expect(r.start?.getMinutes()).toBe(0);
		expect(r.end).toBeNull();
		expect(r.allDay).toBe(false);
		expect(r.range).not.toBeNull();
	});

	it("captures end-time from a 'from X to Y' range", () => {
		const r = parseNaturalSchedule("Standup friday from 9 to 10am", REF);
		expect(r.title).toBe("Standup");
		// "friday" with forwardDate from a Wednesday ⇒ Fri 2026-05-15
		expect(r.start?.getDate()).toBe(15);
		expect(r.start?.getHours()).toBe(9);
		expect(r.end?.getHours()).toBe(10);
		expect(r.allDay).toBe(false);
	});

	it("flags all-day when no clock component is present", () => {
		const r = parseNaturalSchedule("Holiday next monday", REF);
		expect(r.title).toBe("Holiday");
		expect(r.allDay).toBe(true);
		expect(r.start).not.toBeNull();
		expect(r.end).toBeNull();
	});

	it("returns a null start when no temporal phrase is found", () => {
		const r = parseNaturalSchedule("Just a thought", REF);
		expect(r.title).toBe("Just a thought");
		expect(r.start).toBeNull();
		expect(r.end).toBeNull();
		expect(r.allDay).toBe(true);
		expect(r.range).toBeNull();
	});

	it("treats empty input as no-op", () => {
		const r = parseNaturalSchedule("", REF);
		expect(r.title).toBe("");
		expect(r.start).toBeNull();
		expect(r.allDay).toBe(true);
	});

	it("collapses internal whitespace left by the slice", () => {
		const r = parseNaturalSchedule("Buy   milk  tomorrow   at 3pm", REF);
		// Two spaces between "Buy" and "milk" are preserved? collapse to one.
		expect(r.title).toBe("Buy milk");
	});

	it("uses the LAST temporal phrase when more than one is present", () => {
		const r = parseNaturalSchedule("Tuesday review tomorrow at 9am", REF);
		// "tomorrow" wins over "Tuesday".
		expect(r.start?.getDate()).toBe(14);
		expect(r.start?.getHours()).toBe(9);
	});
});
