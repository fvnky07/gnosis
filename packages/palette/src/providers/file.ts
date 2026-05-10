import type { PaletteProvider } from "../types";

/**
 * `f ` prefix — fuzzy file search. Strips the prefix, passes the rest to
 * `ctx.exec.listFiles`, and opens the chosen file via `ctx.exec.openFile`.
 */
export const fileProvider: PaletteProvider = {
	id: "file",
	trigger: "f ",
	scope: ["root", "fileSearch"],
	rank: 30,
	match(query) {
		return query.startsWith("f ") || query === "f";
	},
	async results(query, _signal, ctx) {
		const trimmed = query.replace(/^f\s+/i, "").trim();
		const hits = await ctx.exec.listFiles(trimmed);
		return hits.map((hit) => ({
			id: `file:${hit.path}`,
			label: hit.title,
			detail: hit.path,
			meta: { path: hit.path, preview: hit.preview },
		}));
	},
	async onSubmit(item, ctx) {
		const path = item.meta?.path as string | undefined;
		if (!path) return;
		await ctx.exec.openFile(path);
	},
};
