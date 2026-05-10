import type { PaletteProvider } from "../types";

/**
 * `?` shows a single inline result card listing every prefix. Cheapest
 * possible discoverability win — typing `?` always returns useful guidance.
 */
export const helpProvider: PaletteProvider = {
	id: "help",
	trigger: "?",
	scope: ["root", "help"],
	rank: 0,
	match(query) {
		return query.startsWith("?");
	},
	async results() {
		return [
			{
				id: "help.card",
				label: "Palette quick reference",
				detail:
					"> command  ·  f file  ·  b block  ·  o outline  ·  j journal  ·  t task  ·  n note  ·  v view  ·  tpl template",
			},
		];
	},
	async onSubmit() {
		// No-op: the help card is informational.
	},
};
