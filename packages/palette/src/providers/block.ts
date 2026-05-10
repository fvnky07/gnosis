import type { PaletteProvider } from "../types";

/**
 * `b ` prefix — full-text block search. Strips the prefix, passes the rest
 * to `ctx.exec.searchBlocks`, and jumps to the block via `ctx.exec.openBlock`.
 */
export const blockProvider: PaletteProvider = {
	id: "block",
	trigger: "b ",
	scope: ["root", "blockSearch"],
	rank: 35,
	match(query) {
		return query.startsWith("b ") || query === "b";
	},
	async results(query, _signal, ctx) {
		const trimmed = query.replace(/^b\s+/i, "").trim();
		const hits = await ctx.exec.searchBlocks(trimmed);
		return hits.map((hit) => ({
			id: `block:${hit.id}`,
			label: hit.headline,
			detail: hit.snippet,
			meta: { blockId: hit.id, filePath: hit.filePath, rank: hit.rank },
		}));
	},
	async onSubmit(item, ctx) {
		const blockId = item.meta?.blockId as string | undefined;
		if (!blockId) return;
		await ctx.exec.openBlock(blockId);
	},
};
