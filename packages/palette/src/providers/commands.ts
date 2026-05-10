import type { CommandRegistry } from "../commands";
import type { PaletteProvider } from "../types";

/**
 * `commands` provider: the `>` prefix surfaces every command from the
 * supplied {@link CommandRegistry}. Filtering uses the registry's own
 * `match()` so alias matching and `shouldShow` filters apply.
 */
export function createCommandsProvider(
	registry: CommandRegistry,
): PaletteProvider {
	return {
		id: "commands",
		trigger: ">",
		scope: ["root", "commands"],
		rank: 10,
		match(query) {
			return query.startsWith(">");
		},
		async results(query, _signal, ctx) {
			const stripped = query.replace(/^>\s*/, "");
			const matches = registry.match(stripped, ctx);
			return matches.map(({ command }) => ({
				id: `command:${command.id}`,
				label: command.label,
				detail: command.hint,
				meta: { commandId: command.id, shortcut: command.shortcut },
			}));
		},
		async onSubmit(item, ctx) {
			const commandId = item.meta?.commandId as string | undefined;
			if (!commandId) return;
			await ctx.exec.runCommand(commandId);
		},
	};
}
