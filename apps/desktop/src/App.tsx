import type {
	EditorOptions,
	SelectionInfo,
	VimHostBindings,
	VimMode,
	VimOptions,
} from "@gnosis/editor";
import { CommandPalette, type PaletteCtx } from "@gnosis/palette";
import type { ViewBlock } from "@gnosis/views";
import {
	useGlobalVim,
	useVimRuntime,
	WhichKeyOverlay,
} from "@gnosis/vim-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockDetailsPopover } from "./components/BlockDetailsPopover";
import { AnimatePresence, PaneShell } from "./components/PaneShell";
import { SettingsDialog } from "./components/SettingsDialog";
import { TabSwitcher } from "./components/TabSwitcher";
import { TopBar } from "./components/TopBar";
import { ViewCard, type ViewKind } from "./components/ViewCard";
import { EditorPane } from "./EditorPane";
import { openDb, readSchemaVersion } from "./lib/db";
import { error as logError, info as logInfo, warn as logWarn } from "./lib/log";
import { createRuntime, type DesktopRuntime } from "./lib/runtime";
import { useApplySettings } from "./lib/settings-apply";
import { useSettings } from "./lib/settings-store";
import { ensureVaultPath } from "./lib/vault";
import { usePaletteEngine } from "./use-palette";

type BootstrapStatus =
	| { kind: "starting" }
	| { kind: "browser-preview" }
	| { kind: "needs-vault" }
	| {
			kind: "ready";
			vaultPath: string;
			schemaVersion: number | null;
	  }
	| { kind: "error"; message: string };

function isInsideTauri(): boolean {
	if (typeof window === "undefined") return false;
	const w = window as unknown as {
		__TAURI_INTERNALS__?: unknown;
		__TAURI__?: unknown;
	};
	return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

const WELCOME_ORG = `#+TITLE: Welcome to gnosis

* TODO try vim
SCHEDULED: <2026-05-10 Sun>
press \`Esc\` then \`i\` to enter INSERT mode and edit. Use \`:\` for ex commands.

* this vault is empty
drop \`.org\` files into this folder, or capture one via \`⌘K\` →
\`j hello world\`. on next launch the indexer will pick them up
and the editor will open the first one instead of this welcome doc.
`;

/**
 * Maps palette / vim view ids to internal pane kinds. The palette currently
 * exposes `agenda` (back-compat alias for the day view) plus the explicit
 * `agenda-day | agenda-month | agenda-year` ids.
 */
function resolveViewKind(id: string): ViewKind {
	if (id === "journal" || id === "todos") return id;
	if (id === "agenda-day" || id === "agenda" || id === "agenda-week")
		return "agenda-day";
	if (id === "agenda-month") return "agenda-month";
	if (id === "agenda-year") return "agenda-year";
	return "journal";
}

export default function App() {
	const [status, setStatus] = useState<BootstrapStatus>({ kind: "starting" });

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!isInsideTauri()) {
				setStatus({ kind: "browser-preview" });
				return;
			}
			try {
				await openDb();
				const schemaVersion = await readSchemaVersion();
				const vaultPath = await ensureVaultPath();
				if (cancelled) return;
				if (!vaultPath) {
					setStatus({ kind: "needs-vault" });
					await logInfo("Vault picker dismissed; awaiting user.");
					return;
				}
				setStatus({ kind: "ready", vaultPath, schemaVersion });
				await logInfo(`Vault ready: ${vaultPath} (schema v${schemaVersion}).`);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				if (cancelled) return;
				setStatus({ kind: "error", message });
				try {
					await logError(`Bootstrap failed: ${message}`);
				} catch {
					console.error("Bootstrap failed:", message);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (status.kind === "ready") {
		return (
			<ReadyShell
				vaultPath={status.vaultPath}
				schemaVersion={status.schemaVersion}
			/>
		);
	}

	return (
		<div className="drag-region flex h-dvh w-dvw items-center justify-center bg-background text-foreground">
			<div className="no-drag-region max-w-md text-center">
				<h1 className="font-semibold text-2xl tracking-tight">gnosis</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					desktop shell — phase 0–2 bootstrap
				</p>
				<div className="mt-6 text-sm">{renderStatus(status)}</div>
			</div>
		</div>
	);
}

interface ReadyShellProps {
	vaultPath: string;
	schemaVersion: number | null;
}

function ReadyShell({ vaultPath, schemaVersion }: ReadyShellProps) {
	const runtimeRef = useRef<DesktopRuntime | null>(null);
	if (runtimeRef.current === null) {
		runtimeRef.current = createRuntime(vaultPath);
	}
	const runtime = runtimeRef.current;

	const [blocks, setBlocks] = useState<ViewBlock[]>([]);
	const [indexNote, setIndexNote] = useState<string>("indexing…");
	const [activeBuffer, setActiveBuffer] = useState<{
		id: string;
		filePath: string;
		doc: string;
	}>({ id: "welcome", filePath: "(welcome)", doc: WELCOME_ORG });
	const [selection, setSelection] = useState<SelectionInfo | null>(null);

	// Multi-pane workspace: each open view renders as a peer pane in the
	// main flex row alongside the editor. Duplicate kinds are ignored so the
	// palette opening "agenda-day" twice doesn't stack panes.
	const [openPanes, setOpenPanes] = useState<ViewKind[]>([]);

	const openPane = useCallback((kind: ViewKind) => {
		setOpenPanes((cur) => (cur.includes(kind) ? cur : [...cur, kind]));
	}, []);

	const closePane = useCallback((kind: ViewKind) => {
		setOpenPanes((cur) => cur.filter((k) => k !== kind));
	}, []);

	const closeAllPanes = useCallback(() => {
		setOpenPanes([]);
	}, []);

	const openView = useCallback(
		(id: string) => {
			openPane(resolveViewKind(id));
		},
		[openPane],
	);

	const refresh = useCallback(async () => {
		const next = await runtime.loadViewBlocks();
		setBlocks(next);
	}, [runtime]);

	// ── vim store ─────────────────────────────────────────────────────────────
	const setMode = useVimRuntime((s) => s.setMode);
	const onVimModeChange = useCallback(
		(mode: VimMode) => {
			setMode(mode);
		},
		[setMode],
	);

	// ── settings dialog ───────────────────────────────────────────────────────
	const [settingsOpen, setSettingsOpen] = useState(false);

	// ── palette engine ────────────────────────────────────────────────────────
	const toggleVim = useSettings((s) => s.toggleVim);
	const toggleTheme = useSettings((s) => s.toggleTheme);
	const updateEditor = useSettings((s) => s.updateEditor);
	const { palette, commands, open, setOpen } = usePaletteEngine({
		onRefreshIndex: async () => {
			await runtime.coldIndex();
			await refresh();
		},
		onToggleVim: () => {
			toggleVim();
		},
		onToggleTheme: () => {
			toggleTheme();
		},
		onToggleLineNumbers: () => {
			const current = useSettings.getState().editor.lineNumbers;
			updateEditor({ lineNumbers: current === "off" ? "absolute" : "off" });
		},
		onToggleWordWrap: () => {
			const current = useSettings.getState().editor.wordWrap;
			updateEditor({ wordWrap: !current });
		},
		onOpenSettings: () => {
			setSettingsOpen(true);
		},
	});

	// Seed value passed to the palette on the next open. Bumped whenever
	// vim's `:` / `/` bridge wants to drop the user into a prefix.
	const [paletteSeed, setPaletteSeed] = useState<string | undefined>(undefined);
	const openPaletteWith = useCallback(
		(seed?: string) => {
			setPaletteSeed(seed);
			setOpen(true);
		},
		[setOpen],
	);
	useEffect(() => {
		if (!open) setPaletteSeed(undefined);
	}, [open]);

	// ── global vim leader handler ─────────────────────────────────────────────
	useGlobalVim({
		openPalette: () => openPaletteWith(),
		openCapture: () => openPaletteWith(),
		openBlockDetails: () => setBlockDetailsOpen(true),
		openOutline: () => openPaletteWith("o "),
		openViewsSubmode: () => openPaletteWith("v "),
	});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const result = await runtime.coldIndex();
				if (cancelled) return;
				setIndexNote(
					`indexed ${result.filesParsed} file${result.filesParsed === 1 ? "" : "s"} · idsMinted ${result.idsMinted}`,
				);
				await refresh();
				const files = await runtime.vault.list();
				if (cancelled) return;
				const first = files[0];
				if (first) {
					try {
						const doc = await runtime.vault.read(first.path);
						if (cancelled) return;
						setActiveBuffer({ id: first.path, filePath: first.path, doc });
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						await logWarn(`Failed to open ${first.path}: ${message}`);
					}
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				if (cancelled) return;
				setIndexNote("index failed");
				try {
					await logWarn(`Cold index failed: ${message}`);
				} catch {
					console.warn("Cold index failed:", message);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [runtime, refresh]);

	// ── palette context (executor methods) ───────────────────────────────────
	const ctx = useMemo<PaletteCtx>(
		() => ({
			vaultRoot: vaultPath,
			activeFilePath: activeBuffer.filePath,
			selectedBlockId: null,
			exec: {
				captureJournal: async (text) => {
					await runtime.capture("journal", text);
					await refresh();
				},
				captureTask: async (text) => {
					await runtime.capture("task", text);
					await refresh();
				},
				captureNote: async (text) => {
					await runtime.capture("note", text);
					await refresh();
				},
				openView: async (viewId) => {
					openView(viewId);
				},
				runCommand: async (commandId) => {
					const command = commands.get(commandId);
					await logInfo(`palette: runCommand — ${commandId}`);
					await command?.run(ctx);
				},
				listFiles: (q) => runtime.listFiles(q),
				searchBlocks: async (q) => {
					const rows = await runtime.searchBlocks(q);
					return rows.map((r) => ({
						id: r.id,
						filePath: r.filePath,
						headline: r.headlineRaw,
						snippet: r.snippet,
						rank: r.rank,
					}));
				},
				listOutline: (filePath) => runtime.listOutline(filePath),
				listTabs: () => runtime.listTabs(),
				openFile: async (path) => {
					const doc = await runtime.openFile(path);
					setActiveBuffer({ id: path, filePath: path, doc });
				},
				openBlock: async (blockId) => {
					const ref = await runtime.openBlock(blockId);
					if (ref) {
						const doc = await runtime.openFile(ref.filePath);
						setActiveBuffer({
							id: ref.filePath,
							filePath: ref.filePath,
							doc,
						});
					}
				},
			},
		}),
		// `commands` and `runtime` are stable across renders; `refresh` is
		// memoized on `runtime`. vaultPath changes only when the user re-picks.
		[vaultPath, activeBuffer.filePath, commands, runtime, refresh, openView],
	);

	// ── vim host bindings (editor ex commands + cmdline bridge) ──────────────
	const vimHostBindings = useMemo<VimHostBindings>(
		() => ({
			capture: async (kind, text) => {
				await runtime.capture(kind, text);
				await refresh();
			},
			toggleDone: async () => {},
			toggleTodo: async () => {},
			schedule: async (_date) => {},
			deadline: async (_date) => {},
			setPriority: async () => {},
			addTag: async () => {},
			removeTag: async () => {},
			extractRefile: async () => {},
			openFile: async (path) => {
				const doc = await runtime.openFile(path);
				setActiveBuffer({ id: path, filePath: path, doc });
			},
			searchBlocks: async (_q) => {
				openPaletteWith("b ");
			},
			openView: async (id) => {
				openView(id);
			},
			openVault: async () => {},
			openSettings: async () => {
				setSettingsOpen(true);
			},
			reindex: async () => {
				await runtime.coldIndex();
				await refresh();
			},
			saveBuffer: async () => {},
			closeBuffer: async () => {},
			openCommandLine: (trigger) => {
				// `:` → commands prefix, `/` → block search prefix.
				openPaletteWith(trigger === "/" ? "b " : "> ");
			},
		}),
		[runtime, refresh, openPaletteWith, openView],
	);

	// Cmd+Shift+B closes every open view pane (no-op if none are open).
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const isMac =
				typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
			const summon = isMac ? event.metaKey : event.ctrlKey;
			if (summon && event.shiftKey && event.key.toLowerCase() === "b") {
				event.preventDefault();
				closeAllPanes();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [closeAllPanes]);

	// Cmd+, opens the settings dialog (parity with palette command and the
	// vim `:settings` ex command).
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const isMac =
				typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
			const summon = isMac ? event.metaKey : event.ctrlKey;
			if (summon && event.key === ",") {
				event.preventDefault();
				setSettingsOpen((prev) => !prev);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	// ── block details popover ─────────────────────────────────────────────────
	const [blockDetailsOpen, setBlockDetailsOpen] = useState(false);
	const selectedBlock = blocks[0] ?? null;

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const isMac =
				typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
			const mod = isMac ? event.metaKey : event.ctrlKey;
			if (mod && event.shiftKey && event.key.toLowerCase() === "i") {
				event.preventDefault();
				setBlockDetailsOpen((prev) => !prev);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// ── tab switcher (Ctrl+Tab MRU overlay, kept as transient affordance) ─────
	const tabs = useMemo(
		() => [
			{
				id: activeBuffer.id,
				filePath: activeBuffer.filePath,
				title: activeBuffer.filePath.split("/").pop() ?? activeBuffer.filePath,
			},
		],
		[activeBuffer],
	);
	const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false);
	const [tabSwitcherIndex, setTabSwitcherIndex] = useState(0);

	useEffect(() => {
		let ctrlHeld = false;
		function down(e: KeyboardEvent) {
			if (e.key === "Control") ctrlHeld = true;
			if (e.key === "Tab" && ctrlHeld) {
				e.preventDefault();
				setTabSwitcherOpen(true);
				setTabSwitcherIndex((i) => (i + 1) % Math.max(tabs.length, 1));
			}
		}
		function up(e: KeyboardEvent) {
			if (e.key === "Control") {
				ctrlHeld = false;
				if (tabSwitcherOpen) {
					const tab = tabs[tabSwitcherIndex];
					if (tab) {
						runtime
							.openFile(tab.filePath)
							.then((doc) => {
								setActiveBuffer({
									id: tab.filePath,
									filePath: tab.filePath,
									doc,
								});
							})
							.catch(() => {});
					}
					setTabSwitcherOpen(false);
				}
			}
		}
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, [tabs, tabSwitcherIndex, tabSwitcherOpen, runtime]);

	void schemaVersion;
	void indexNote;

	useApplySettings();

	const layoutSettings = useSettings((s) => s.layout);
	const topBarVisible = useSettings((s) => s.interface.topBar.visible);
	const paletteAppearance = useSettings((s) => s.interface.palette);
	const cardBorderVisible = useSettings((s) => s.appearance.cardBorderVisible);
	const editorSettings = useSettings((s) => s.editor);
	const vimSettings = useSettings((s) => s.vim);

	const editorOpts = useMemo<EditorOptions>(
		() => ({
			fontFamily: editorSettings.fontFamily,
			fontSize: editorSettings.fontSize,
			lineHeight: editorSettings.lineHeight,
			letterSpacingPx: editorSettings.letterSpacingPx,
			fontLigatures: editorSettings.fontLigatures,
			lineNumbers: editorSettings.lineNumbers,
			foldGutter: editorSettings.foldGutter,
			wordWrap: editorSettings.wordWrap,
			tabSize: editorSettings.tabSize,
			insertSpaces: editorSettings.insertSpaces,
			highlightActiveLine: editorSettings.highlightActiveLine,
			matchBrackets: editorSettings.matchBrackets,
			closeBrackets: editorSettings.closeBrackets,
			indentGuides: editorSettings.indentGuides,
			cursorStyle: editorSettings.cursorStyle,
			cursorBlink: editorSettings.cursorBlink,
			cursorWidthPx: editorSettings.cursorWidthPx,
			autocomplete: editorSettings.autocomplete,
			rulers: editorSettings.rulers,
			renderWhitespace: editorSettings.renderWhitespace,
		}),
		[editorSettings],
	);

	const vimOpts = useMemo<VimOptions>(
		() => ({
			jkEscape: vimSettings.jkEscape,
			jkTimeoutMs: vimSettings.jkTimeoutMs,
			relativeNumbers: vimSettings.relativeNumbers,
			smartCase: vimSettings.smartCase,
			systemClipboard: vimSettings.systemClipboard,
			startInNormal: vimSettings.startInNormal,
		}),
		[vimSettings],
	);

	return (
		<div
			className="drag-region flex h-dvh w-dvw flex-col overflow-hidden bg-background text-foreground"
			style={{
				paddingLeft: "var(--outer-gap)",
				paddingRight: "var(--outer-gap)",
				paddingBottom: "var(--outer-gap)",
				paddingTop: 0,
			}}
		>
			{topBarVisible ? (
				<TopBar
					vaultPath={vaultPath}
					activeFilePath={activeBuffer.filePath}
					selection={selection}
					onOpenPalette={() => openPaletteWith()}
					onOpenView={(id) => openView(id)}
				/>
			) : null}
			<main
				className="no-drag-region flex min-h-0 flex-1 items-stretch overflow-hidden"
				style={{
					gap: "var(--inner-gap)",
					borderWidth: cardBorderVisible ? "1px" : "0px",
					borderStyle: "solid",
					borderColor: "var(--border)",
					borderRadius: "var(--radius-xl, 0.75rem)",
				}}
			>
				<AnimatePresence initial={false}>
					<PaneShell key="editor" paneKey="editor">
						<div
							className={`flex h-full min-w-0 flex-1 overflow-hidden rounded-xl bg-card text-card-foreground ${layoutSettings.centerContent ? "justify-center" : ""}`}
						>
							<div
								className="flex min-w-0 flex-1 overflow-hidden"
								style={{
									maxWidth: `${layoutSettings.noteWidthPct}%`,
								}}
							>
								<EditorPane
									bufferId={activeBuffer.id}
									filePath={activeBuffer.filePath}
									initialDoc={activeBuffer.doc}
									vimEnabled={vimSettings.enabled}
									editorOpts={editorOpts}
									vimOpts={vimOpts}
									vimHostBindings={vimHostBindings}
									onVimModeChange={onVimModeChange}
									onSelectionChange={setSelection}
									onChange={() => {
										// Idle-debounced write-back wires in next slice.
									}}
									className="h-full w-full overflow-auto"
									style={{
										padding: "var(--editor-padding-y) var(--editor-padding-x)",
									}}
								/>
							</div>
						</div>
					</PaneShell>
					{openPanes.map((kind) => (
						<PaneShell key={kind} paneKey={kind}>
							<ViewCard
								blocks={blocks}
								view={kind}
								onClose={() => closePane(kind)}
							/>
						</PaneShell>
					))}
				</AnimatePresence>
			</main>

			<CommandPalette
				registry={palette}
				commandRegistry={commands}
				ctx={ctx}
				open={open}
				seed={paletteSeed}
				appearance={paletteAppearance}
				onClose={() => setOpen(false)}
			/>
			<SettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				vaultPath={vaultPath}
			/>
			<BlockDetailsPopover
				block={selectedBlock}
				open={blockDetailsOpen}
				onOpenChange={setBlockDetailsOpen}
				anchor={null}
			/>
			<TabSwitcher
				tabs={tabs}
				open={tabSwitcherOpen}
				selectedIndex={tabSwitcherIndex}
				onSelectedIndexChange={setTabSwitcherIndex}
				onCommit={(id) => {
					const tab = tabs.find((t) => t.id === id);
					if (tab) {
						runtime
							.openFile(tab.filePath)
							.then((doc) => {
								setActiveBuffer({
									id: tab.filePath,
									filePath: tab.filePath,
									doc,
								});
							})
							.catch(() => {});
					}
					setTabSwitcherOpen(false);
				}}
				onCancel={() => setTabSwitcherOpen(false)}
			/>
			<WhichKeyOverlay />
		</div>
	);
}

function renderStatus(status: BootstrapStatus) {
	switch (status.kind) {
		case "starting":
			return <span className="text-muted-foreground">Booting…</span>;
		case "browser-preview":
			return (
				<div className="space-y-2 text-muted-foreground">
					<p>Vite preview only — no Tauri runtime detected.</p>
					<p className="text-xs">
						Run <code className="font-mono">bun run tauri:dev</code> from the
						repo root to launch the native window with sqlite + dialog wired.
					</p>
				</div>
			);
		case "needs-vault":
			return (
				<span className="text-muted-foreground">
					No vault selected yet. Restart and choose a folder when prompted.
				</span>
			);
		case "ready":
			return null;
		case "error":
			return (
				<span className="text-red-500">Bootstrap error: {status.message}</span>
			);
	}
}
