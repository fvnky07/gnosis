import type { PaletteProvider } from "../types";

/**
 * `tabs ` prefix — lists open editor tabs. The host is responsible for
 * invoking this mode; the provider itself just needs a trigger prefix so the
 * engine can route to it. Results are all open tabs from `ctx.exec.listTabs`;
 * the query is used for in-memory label filtering. Submit opens the file.
 */
export const tabsProvider: PaletteProvider = {
	id: "tabs",
	trigger: "tabs ",
	scope: ["root", "tabs"],
	rank: 25,
	match(query) {
		return query.startsWith("tabs ") || query === "tabs";
	},
	async results(query, _signal, ctx) {
		const stripped = query.replace(/^tabs\s*/i, "").toLowerCase();
		const hits = await ctx.exec.listTabs();
		const filtered =
			stripped.length === 0
				? hits
				: hits.filter(
						(h) =>
							h.title.toLowerCase().includes(stripped) ||
							h.filePath.toLowerCase().includes(stripped),
					);
		return filtered.map((hit) => ({
			id: `tab:${hit.id}`,
			label: hit.title,
			detail: hit.filePath,
			meta: { filePath: hit.filePath, tabId: hit.id, active: hit.active },
		}));
	},
	async onSubmit(item, ctx) {
		const filePath = item.meta?.filePath as string | undefined;
		if (!filePath) return;
		await ctx.exec.openFile(filePath);
	},
};
