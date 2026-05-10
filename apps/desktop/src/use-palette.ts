import {
	CommandRegistry,
	captureProvider,
	createCommandsProvider,
	helpProvider,
	PaletteRegistry,
	recentFilesProvider,
	viewProvider,
} from "@gnosis/palette";
import { useEffect, useMemo, useState } from "react";

/**
 * Wire the palette engine for `apps/desktop`. Returns the registry
 * pair plus an `open`/`setOpen` toggle bound to `Cmd+K` (or `Ctrl+K` on
 * non-mac). The host renders a `<CommandPalette>` driven by these.
 *
 * Capture / view / runCommand executors are the real actions the palette
 * can perform. The MVP versions just log; phase 6b wires them through to
 * `@gnosis/core` `emitAppendBlock` + the `TauriVault` adapter.
 */
export function usePaletteEngine() {
	const registries = useMemo(() => {
		const palette = new PaletteRegistry();
		const commands = new CommandRegistry();
		palette.register(helpProvider);
		palette.register(captureProvider);
		palette.register(viewProvider);
		palette.register(recentFilesProvider);
		palette.register(createCommandsProvider(commands));
		// Seed a minimal command set so `>` is not empty on first launch.
		commands.register({
			id: "vault.refresh",
			label: "Refresh index",
			aliases: ["reindex", "scan"],
			run: async () => {
				// Wired to indexer.cold() in the next slice.
			},
		});
		commands.register({
			id: "settings.open",
			label: "Open Settings",
			aliases: ["preferences", "config"],
			run: async () => {},
		});
		commands.register({
			id: "vim.toggle",
			label: "Toggle vim mode",
			aliases: ["modal"],
			run: async () => {},
		});
		return { palette, commands };
	}, []);

	const [open, setOpen] = useState(false);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const isMac =
				typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
			const summon = isMac ? event.metaKey : event.ctrlKey;
			if (summon && event.key.toLowerCase() === "k" && !event.shiftKey) {
				event.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	return { ...registries, open, setOpen };
}
