/**
 * TabSwitcher smoke tests.
 *
 * NOTE: `apps/desktop` has no DOM test runner configured (no happy-dom /
 * jsdom / vitest setup). These tests use bun:test + react-dom/server
 * `renderToString` as a lightweight alternative that requires zero extra
 * dependencies. They verify JSX tree shape without a full DOM environment.
 *
 * To run: `cd apps/desktop && bun test src/components/__tests__/TabSwitcher.test.tsx`
 * (bun:test is built-in; no install required.)
 */
import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { TabSwitcher } from "../TabSwitcher";

const TABS = [
	{ id: "a", title: "Alpha", filePath: "/vault/alpha.org" },
	{ id: "b", title: "Beta", filePath: "/vault/beta.org" },
	{ id: "c", title: "Gamma", filePath: "/vault/gamma.org" },
];

const noop = () => {};

describe("TabSwitcher", () => {
	it("returns null when open is false", () => {
		const result = TabSwitcher({
			tabs: TABS,
			open: false,
			selectedIndex: 0,
			onSelectedIndexChange: noop,
			onCommit: noop,
			onCancel: noop,
		});
		expect(result).toBeNull();
	});

	it("renders all tab titles when open is true", () => {
		const html = renderToString(
			<TabSwitcher
				tabs={TABS}
				open={true}
				selectedIndex={0}
				onSelectedIndexChange={noop}
				onCommit={noop}
				onCancel={noop}
			/>,
		);
		expect(html).toContain("Alpha");
		expect(html).toContain("Beta");
		expect(html).toContain("Gamma");
	});

	it("marks the selected row with data-selected='true'", () => {
		const html = renderToString(
			<TabSwitcher
				tabs={TABS}
				open={true}
				selectedIndex={1}
				onSelectedIndexChange={noop}
				onCommit={noop}
				onCancel={noop}
			/>,
		);
		// The second tab (Beta) should carry data-selected="true"
		expect(html).toContain('data-selected="true"');
		// Verify it is associated with Beta by checking proximity in the string
		const selectedIdx = html.indexOf('data-selected="true"');
		const betaIdx = html.indexOf("Beta");
		expect(selectedIdx).toBeGreaterThan(-1);
		expect(betaIdx).toBeGreaterThan(-1);
		// data-selected should appear before Beta's text in the same list item
		expect(Math.abs(selectedIdx - betaIdx)).toBeLessThan(300);
	});

	it("renders data-testid='tab-switcher' on the root element", () => {
		const html = renderToString(
			<TabSwitcher
				tabs={TABS}
				open={true}
				selectedIndex={0}
				onSelectedIndexChange={noop}
				onCommit={noop}
				onCancel={noop}
			/>,
		);
		expect(html).toContain('data-testid="tab-switcher"');
	});

	it("shows 'No open tabs' when tabs array is empty", () => {
		const html = renderToString(
			<TabSwitcher
				tabs={[]}
				open={true}
				selectedIndex={0}
				onSelectedIndexChange={noop}
				onCommit={noop}
				onCancel={noop}
			/>,
		);
		expect(html).toContain("No open tabs");
	});
});
