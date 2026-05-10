import type { PaletteProvider } from "../types";

/**
 * Stub `recentFiles` provider. Returns nothing in MVP — the real
 * implementation queries the indexer's `app_state.palette_frecency` map
 * for files and returns the top N. Lives here for shape so the rest of
 * the palette can register it and ship; the FTS5 + frecency wire-up
 * lands alongside `fileSearch` in phase 6b.
 */
export const recentFilesProvider: PaletteProvider = {
	id: "recentFiles",
	scope: ["root", "recentFiles"],
	rank: 90,
	match(query) {
		return query.trim().length === 0;
	},
	async results() {
		return [];
	},
	async onSubmit() {
		// No-op until phase 6b lights this up against the real frecency map.
	},
};
