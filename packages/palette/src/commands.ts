import type { PaletteCtx } from "./types";

/**
 * A single command in the {@link CommandRegistry}. Aliases boost
 * discoverability without bloating labels — e.g. `archive` finds `Mark as
 * DONE`. `shouldShow` lets context-sensitive commands hide themselves
 * (e.g. "Mark current block as DONE" is hidden when no block is selected).
 */
export interface Command {
	id: string;
	label: string;
	aliases?: string[];
	hint?: string;
	shortcut?: string;
	shouldShow?(ctx: PaletteCtx): boolean;
	run(ctx: PaletteCtx): Promise<void> | void;
}

/**
 * Mutable, in-memory command store. Bound by the host at boot. Filtering is
 * performed by `match()` — case-insensitive substring against label and
 * every alias. Score is exposed for callers that want to combine it with
 * frecency before sorting.
 */
export class CommandRegistry {
	private commands = new Map<string, Command>();

	register(command: Command): void {
		this.commands.set(command.id, command);
	}

	unregister(commandId: string): void {
		this.commands.delete(commandId);
	}

	get(commandId: string): Command | undefined {
		return this.commands.get(commandId);
	}

	all(): readonly Command[] {
		return [...this.commands.values()];
	}

	/**
	 * Match a query against label + aliases. Returns the matching commands
	 * sorted by relevance (label exact > label prefix > label contains >
	 * alias contains > nothing). `shouldShow(ctx)` filters out
	 * context-disabled commands. Empty query returns every visible command
	 * in registration order.
	 */
	match(query: string, ctx: PaletteCtx): { command: Command; score: number }[] {
		const visible = this.all().filter(
			(c) => !c.shouldShow || c.shouldShow(ctx),
		);
		if (query.trim() === "") {
			return visible.map((command) => ({ command, score: 0 }));
		}
		const q = query.toLowerCase();
		const scored: { command: Command; score: number }[] = [];
		for (const command of visible) {
			const score = scoreCommand(command, q);
			if (score > 0) scored.push({ command, score });
		}
		scored.sort((a, b) => b.score - a.score);
		return scored;
	}
}

function scoreCommand(command: Command, q: string): number {
	const label = command.label.toLowerCase();
	if (label === q) return 100;
	if (label.startsWith(q)) return 80;
	if (label.includes(q)) return 60;
	for (const alias of command.aliases ?? []) {
		const a = alias.toLowerCase();
		if (a === q) return 70;
		if (a.startsWith(q)) return 50;
		if (a.includes(q)) return 30;
	}
	return 0;
}
