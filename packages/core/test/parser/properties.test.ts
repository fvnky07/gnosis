import { describe, expect, it } from "vitest";
import { parsePropertiesDrawer } from "../../src/parser/properties";

describe("parsePropertiesDrawer", () => {
	it("returns empty when no drawer is present", () => {
		const result = parsePropertiesDrawer("plain body text\nno drawer here\n");
		expect(result.properties).toEqual({});
		expect(result.drawerStart).toBe(-1);
		expect(result.drawerEnd).toBe(-1);
		expect(result.warnings).toEqual([]);
	});

	it("parses a simple drawer", () => {
		const text =
			":PROPERTIES:\n:ID:       01J9EXAMPLE\n:CREATED:  [2026-05-06 Wed 10:13]\n:END:\nbody after\n";
		const result = parsePropertiesDrawer(text);
		expect(result.properties).toEqual({
			ID: "01J9EXAMPLE",
			CREATED: "[2026-05-06 Wed 10:13]",
		});
		expect(result.drawerStart).toBe(0);
		expect(result.drawerEnd).toBe(text.indexOf("body after"));
	});

	it("warns on unterminated drawer", () => {
		const text = ":PROPERTIES:\n:ID: 01J9\n";
		const result = parsePropertiesDrawer(text);
		expect(
			result.warnings.some((w) => w.code === "unterminated-properties-drawer"),
		).toBe(true);
	});

	it("skips leading blank lines", () => {
		const text = "\n\n:PROPERTIES:\n:ID: 01J9\n:END:\n";
		const result = parsePropertiesDrawer(text);
		expect(result.properties.ID).toBe("01J9");
	});

	it("does not match if non-blank non-drawer line precedes", () => {
		const text = "some text\n:PROPERTIES:\n:ID: 01J9\n:END:\n";
		const result = parsePropertiesDrawer(text);
		expect(result.drawerStart).toBe(-1);
		expect(result.properties).toEqual({});
	});

	it("strips trailing whitespace from values", () => {
		const text = ":PROPERTIES:\n:KEY: value with trail   \n:END:\n";
		const result = parsePropertiesDrawer(text);
		expect(result.properties.KEY).toBe("value with trail");
	});
});
