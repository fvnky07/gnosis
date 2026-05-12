import type { PaletteItem, PaletteProvider, PaletteViewId } from "../types";

interface RootEntry {
	id: string;
	label: string;
	detail?: string;
	section: string;
	/** Synonyms / search tokens not present in label or detail. Lets a user
	 * type "preferences" and still hit "Open Settings", or "reindex" and
	 * hit "Refresh index". Lowercased before matching. */
	keywords?: string[];
	/** When set, selecting this item seeds the palette input with the
	 * given prefix and keeps the palette open so the user can continue
	 * typing into the appropriate sub-provider. */
	seed?: string;
	/** Direct action: openView. Mutually exclusive with seed + command. */
	openView?: PaletteViewId;
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
		keywords: ["find", "go to", "navigate"],
		seed: "f ",
	},
	{
		id: "root.nav.blocks",
		label: "Search blocks…",
		detail: "Full-text search across every heading",
		section: "Navigation",
		keywords: ["fts", "find", "grep", "search"],
		seed: "b ",
	},
	{
		id: "root.nav.outline",
		label: "File outline…",
		detail: "Jump to a heading in the active buffer",
		section: "Navigation",
		keywords: ["headings", "toc"],
		seed: "o ",
	},
	{
		id: "root.nav.tabs",
		label: "Switch buffer…",
		detail: "Pick an open editor tab",
		section: "Navigation",
		keywords: ["buffers", "tab", "switch"],
		seed: "tabs ",
	},
	{
		id: "root.nav.daily",
		label: "Open daily note",
		detail: "Jump to today's daily note (creates it if missing)",
		section: "Navigation",
		keywords: ["today", "journal", "dn", "diary", "daily notes"],
		command: "daily.open",
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
		id: "root.view.agenda-day",
		label: "Open Agenda · Day",
		detail: "Today's scheduled items",
		section: "Views",
		openView: "agenda-day",
		keywords: ["agenda", "today"],
	},
	{
		id: "root.view.agenda-month",
		label: "Open Agenda · Month",
		detail: "Six-week month grid",
		section: "Views",
		openView: "agenda-month",
		keywords: ["agenda", "calendar"],
	},
	{
		id: "root.view.agenda-year",
		label: "Open Agenda · Year",
		detail: "12-month overview",
		section: "Views",
		openView: "agenda-year",
		keywords: ["agenda", "year"],
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
		keywords: ["preferences", "config", "options"],
		command: "settings.open",
	},
	{
		id: "root.action.reindex",
		label: "Refresh index",
		detail: "Rescan the vault and rebuild block index",
		section: "Actions",
		keywords: ["reindex", "rescan", "scan"],
		command: "vault.refresh",
	},
	{
		id: "root.action.vim",
		label: "Toggle vim mode",
		detail: "Switch modal editing on or off",
		section: "Actions",
		keywords: ["modal", "keybindings"],
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
/** Sub-provider triggers that should suppress the root menu so the
 * dedicated provider (commands / files / blocks / capture / etc.) owns
 * the result list cleanly. Anything else lets the root menu fuzzy-match
 * its own entries on top. */
const SUB_PREFIX = /^(?:>|\?|f\s|b\s|o\s|v\s|tabs(?:\s|$)|[jtn]\s)/;

export const rootMenuProvider: PaletteProvider = {
	id: "root-menu",
	scope: ["root"],
	rank: 1,
	match(query) {
		if (query.length === 0) return true;
		return !SUB_PREFIX.test(query);
	},
	async results(query): Promise<PaletteItem[]> {
		const q = query.trim().toLowerCase();
		const matches =
			q.length === 0
				? ROOT_ENTRIES
				: ROOT_ENTRIES.filter((entry) => matchesEntry(entry, q));
		return matches.map((entry) => ({
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
		const viewId = item.meta?.openView as PaletteViewId | undefined;
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

/** Case-insensitive substring match across label, detail, section, and
 * the entry's optional `keywords` synonyms. Subsequence matching keeps
 * "ofile" → "Open file" alive so typos and dropped characters still
 * land on the user's intended action. */
function matchesEntry(entry: RootEntry, q: string): boolean {
	const haystack = [
		entry.label,
		entry.detail ?? "",
		entry.section,
		...(entry.keywords ?? []),
	]
		.join(" ")
		.toLowerCase();
	if (haystack.includes(q)) return true;
	return isSubsequence(q, haystack);
}

/** Returns true iff every character in `needle` appears in `haystack`
 * in order (gaps allowed). Cheap fuzzy fallback for typed-letter-by-letter
 * matches like `oF` → `Open File`. */
function isSubsequence(needle: string, haystack: string): boolean {
	let i = 0;
	for (let j = 0; j < haystack.length && i < needle.length; j++) {
		if (haystack[j] === needle[i]) i++;
	}
	return i === needle.length;
}
