import type { PaletteProvider } from "../types";

/**
 * `o ` prefix — outline of the active file (or the vault when no file is
 * open). Calls `ctx.exec.listOutline` with the active file path and renders
 * headlines with level-based indentation. Navigates via `ctx.exec.openBlock`.
 */
export const outlineProvider: PaletteProvider = {
	id: "outline",
	trigger: "o ",
	scope: ["root", "outline"],
	rank: 40,
	match(query) {
		return query.startsWith("o ") || query === "o";
	},
	async results(_query, _signal, ctx) {
		const hits = await ctx.exec.listOutline(ctx.activeFilePath);
		return hits.map((hit) => ({
			id: `outline:${hit.id}`,
			label: "  ".repeat(Math.max(0, hit.level - 1)) + hit.headline,
			detail: `Line ${hit.line}`,
			meta: { blockId: hit.id, filePath: hit.filePath, level: hit.level },
		}));
	},
	async onSubmit(item, ctx) {
		const blockId = item.meta?.blockId as string | undefined;
		if (!blockId) return;
		await ctx.exec.openBlock(blockId);
	},
};
