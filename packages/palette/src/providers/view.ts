import type { PaletteProvider } from "../types";

const VIEWS: {
	id: "journal" | "agenda" | "todos";
	label: string;
	detail: string;
}[] = [
	{
		id: "journal",
		label: "Open Journal",
		detail: "Reverse-chronological captures",
	},
	{ id: "agenda", label: "Open Agenda", detail: "Week / day / month grids" },
	{ id: "todos", label: "Open Todos", detail: "Kanban + list" },
];

/**
 * `v ` opens one of the three views. Kept tiny — three results, no
 * filtering beyond the prefix. The actual view-mounting work happens in
 * the host via `ctx.exec.openView`.
 */
export const viewProvider: PaletteProvider = {
	id: "view",
	trigger: "v ",
	scope: ["root", "view"],
	rank: 20,
	match(query) {
		return query.startsWith("v ") || query === "v";
	},
	async results(query) {
		const stripped = query.replace(/^v\s*/, "").toLowerCase();
		const matches =
			stripped.length === 0
				? VIEWS
				: VIEWS.filter(
						(v) =>
							v.id.startsWith(stripped) ||
							v.label.toLowerCase().includes(stripped),
					);
		return matches.map((v) => ({
			id: `view:${v.id}`,
			label: v.label,
			detail: v.detail,
			meta: { viewId: v.id },
		}));
	},
	async onSubmit(item, ctx) {
		const viewId = item.meta?.viewId as
			| "journal"
			| "agenda"
			| "todos"
			| undefined;
		if (!viewId) return;
		await ctx.exec.openView(viewId);
	},
};
