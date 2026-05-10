import type { PaletteItem, PaletteProvider } from "../types";

interface RootEntry {
	id: string;
	label: string;
	detail?: string;
	section: string;
	/** When set, selecting this item seeds the palette input with the
	 * given prefix and keeps the palette open so the user can continue
	 * typing into the appropriate sub-provider. */
	seed?: string;
	/** Direct action: openView. Mutually exclusive with seed + command. */
	openView?: "journal" | "agenda" | "todos";
	/** Direct action: runCommand against the host CommandRegistry. */
	command?: string;
}

const ROOT_ENTRIES: RootEntry[] = [
	// ── Navigation ─────────────────────────────────────────────────────────
	{
		id: "root.nav.files",
		label: "Open file…",
		detail: "Fuzzy search across vault files",
		section: "Navigation",
		seed: "f ",
	},
	{
		id: "root.nav.blocks",
		label: "Search blocks…",
		detail: "Full-text search across every heading",
		section: "Navigation",
		seed: "b ",
	},
	{
		id: "root.nav.outline",
		label: "File outline…",
		detail: "Jump to a heading in the active buffer",
		section: "Navigation",
		seed: "o ",
	},
	{
		id: "root.nav.tabs",
		label: "Switch buffer…",
		detail: "Pick an open editor tab",
		section: "Navigation",
		seed: "tabs ",
	},

	// ── Views ──────────────────────────────────────────────────────────────
	{
		id: "root.view.journal",
		label: "Open Journal",
		detail: "Reverse-chronological captures",
		section: "Views",
		openView: "journal",
	},
	{
		id: "root.view.agenda",
		label: "Open Agenda",
		detail: "Week / day / month grids",
		section: "Views",
		openView: "agenda",
	},
	{
		id: "root.view.todos",
		label: "Open Todos",
		detail: "Kanban + list",
		section: "Views",
		openView: "todos",
	},

	// ── Capture ────────────────────────────────────────────────────────────
	{
		id: "root.capture.journal",
		label: "New journal entry…",
		detail: "Append to today's daily note",
		section: "Capture",
		seed: "j ",
	},
	{
		id: "root.capture.task",
		label: "New task…",
		detail: "Append a TODO scheduled for today",
		section: "Capture",
		seed: "t ",
	},
	{
		id: "root.capture.note",
		label: "New note…",
		detail: "Append an untagged heading",
		section: "Capture",
		seed: "n ",
	},

	// ── Actions ────────────────────────────────────────────────────────────
	{
		id: "root.action.settings",
		label: "Open Settings",
		detail: "Preferences · appearance · vim",
		section: "Actions",
		command: "settings.open",
	},
	{
		id: "root.action.reindex",
		label: "Refresh index",
		detail: "Rescan the vault and rebuild block index",
		section: "Actions",
		command: "vault.refresh",
	},
	{
		id: "root.action.vim",
		label: "Toggle vim mode",
		detail: "Switch modal editing on or off",
		section: "Actions",
		command: "vim.toggle",
	},

	// ── Hotkeys / Help ─────────────────────────────────────────────────────
	{
		id: "root.help.command",
		label: "Run command…",
		detail: "Browse every available command (`>` prefix)",
		section: "Hotkeys",
		seed: ">",
	},
	{
		id: "root.help.reference",
		label: "Palette quick reference",
		detail: "Prefix cheatsheet (`?` prefix)",
		section: "Help",
		seed: "?",
	},
];

/**
 * Root-menu provider: surfaces a curated catalog of actions when the
 * palette is opened without a query. Each item is either a direct
 * action (openView / runCommand) or a seed that pre-fills the input
 * with a prefix so the matching sub-provider takes over (Files,
 * Blocks, etc.).
 *
 * Section labels live on each item via `section` so the palette UI
 * groups them under Navigation / Views / Capture / Actions / Help
 * headings without needing per-section providers.
 */
export const rootMenuProvider: PaletteProvider = {
	id: "root-menu",
	scope: ["root"],
	rank: 1,
	match(query) {
		return query.trim().length === 0;
	},
	async results(): Promise<PaletteItem[]> {
		return ROOT_ENTRIES.map((entry) => ({
			id: entry.id,
			label: entry.label,
			detail: entry.detail,
			section: entry.section,
			meta: {
				seed: entry.seed,
				openView: entry.openView,
				command: entry.command,
			},
		}));
	},
	async onSubmit(item, ctx) {
		const viewId = item.meta?.openView as
			| "journal"
			| "agenda"
			| "todos"
			| undefined;
		if (viewId) {
			await ctx.exec.openView(viewId);
			return;
		}
		const command = item.meta?.command as string | undefined;
		if (command) {
			await ctx.exec.runCommand(command);
			return;
		}
		// Seed-only items are handled at the palette UI level (set query,
		// keep open). onSubmit is a no-op when only `seed` is set.
	},
};
