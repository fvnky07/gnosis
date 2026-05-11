import {
	blockProvider,
	CommandRegistry,
	captureProvider,
	createCommandsProvider,
	fileProvider,
	helpProvider,
	outlineProvider,
	PaletteRegistry,
	recentFilesProvider,
	rootMenuProvider,
	tabsProvider,
	viewProvider,
} from "@gnosis/palette";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "./lib/settings-store";

interface PaletteEngineOptions {
	/** Called when the user runs `vault.refresh` from the command palette. */
	onRefreshIndex: () => Promise<void>;
	/** Called when the user runs `vim.toggle`. */
	onToggleVim: () => void;
	/** Called when the user runs `appearance.toggleTheme`. */
	onToggleTheme: () => void;
	/** Called when the user runs `editor.toggleLineNumbers`. */
	onToggleLineNumbers: () => void;
	/** Called when the user runs `editor.toggleWrap`. */
	onToggleWordWrap: () => void;
	/** Called when the user runs `settings.open`. */
	onOpenSettings: () => void;
}

/**
 * Wire the palette engine for `apps/desktop`. Returns the registry
 * pair plus an `open`/`setOpen` toggle.
 *
 * The global vim leader (Space Space) is the primary way to open the palette.
 * Cmd+K is preserved here for muscle-memory; it does not conflict with leader
 * because leader fires on bare Space outside editable surfaces.
 */
export function usePaletteEngine({
	onRefreshIndex,
	onToggleVim,
	onToggleTheme,
	onToggleLineNumbers,
	onToggleWordWrap,
	onOpenSettings,
}: PaletteEngineOptions) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: registries created once; option callbacks captured in command closures
	const registries = useMemo(() => {
		const palette = new PaletteRegistry();
		const commands = new CommandRegistry();

		palette.register(rootMenuProvider);
		palette.register(helpProvider);
		palette.register(captureProvider);
		palette.register(viewProvider);
		palette.register(recentFilesProvider);
		palette.register(fileProvider);
		palette.register(blockProvider);
		palette.register(outlineProvider);
		palette.register(tabsProvider);
		palette.register(createCommandsProvider(commands));

		commands.register({
			id: "vault.refresh",
			label: "Refresh index",
			aliases: ["reindex", "scan"],
			run: async () => {
				await onRefreshIndex();
			},
		});
		commands.register({
			id: "settings.open",
			label: "Open Settings",
			aliases: ["preferences", "config"],
			shortcut: "⌘,",
			run: async () => {
				onOpenSettings();
			},
		});
		commands.register({
			id: "settings.reset",
			label: "Reset settings to defaults",
			aliases: ["reset", "factory"],
			run: async () => {
				if (
					typeof window === "undefined" ||
					window.confirm("Reset every gnosis setting to its default?")
				) {
					useSettings.getState().resetAll();
				}
			},
		});
		commands.register({
			id: "vim.toggle",
			label: "Toggle vim mode",
			aliases: ["modal"],
			run: async () => {
				onToggleVim();
			},
		});
		commands.register({
			id: "appearance.toggleTheme",
			label: "Toggle theme",
			aliases: ["dark mode", "light mode"],
			run: async () => {
				onToggleTheme();
			},
		});
		commands.register({
			id: "editor.toggleLineNumbers",
			label: "Toggle line numbers",
			aliases: ["gutter"],
			run: async () => {
				onToggleLineNumbers();
			},
		});
		commands.register({
			id: "editor.toggleWrap",
			label: "Toggle word wrap",
			aliases: ["wrap"],
			run: async () => {
				onToggleWordWrap();
			},
		});
		return { palette, commands };
	}, []);

	const [open, setOpen] = useState(false);

	// Keep Cmd+K for muscle memory. Leader (Space Space) is the primary trigger
	// and is wired in App.tsx via useGlobalVim — no conflict since leader only
	// fires outside editable surfaces.
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
