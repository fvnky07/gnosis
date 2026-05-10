import type { VimHostBindings, VimMode } from "@gnosis/editor";
import { CommandPalette, type PaletteCtx } from "@gnosis/palette";
import type { ViewBlock } from "@gnosis/views";
import {
	useGlobalVim,
	useVimRuntime,
	WhichKeyOverlay,
} from "@gnosis/vim-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockDetailsPopover } from "./components/BlockDetailsPopover";
import { ResizeHandle } from "./components/ResizeHandle";
import { RightSidebar } from "./components/RightSidebar";
import { StatusBar } from "./components/StatusBar";
import { TabSwitcher } from "./components/TabSwitcher";
import { EditorPane } from "./EditorPane";
import { openDb, readSchemaVersion } from "./lib/db";
import { error as logError, info as logInfo, warn as logWarn } from "./lib/log";
import { createRuntime, type DesktopRuntime } from "./lib/runtime";
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
		<div className="flex h-dvh w-dvw items-center justify-center bg-background text-foreground">
			<div className="max-w-md text-center">
				<h1 className="font-semibold text-2xl">gnosis</h1>
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

	// ── palette engine ────────────────────────────────────────────────────────
	const { palette, commands, open, setOpen } = usePaletteEngine({
		onRefreshIndex: async () => {
			await runtime.coldIndex();
			await refresh();
		},
		onToggleVim: () => {
			// TODO: persist vim-mode preference to settings
		},
		onOpenSettings: () => {
			// TODO: open settings panel
		},
	});

	// ── global vim leader handler ─────────────────────────────────────────────
	useGlobalVim({
		openPalette: () => setOpen(true),
		openCapture: () => setOpen(true), // TODO: seed query for capture preset
		openBlockDetails: () => setBlockDetailsOpen(true),
		openOutline: () => setOpen(true), // TODO: seed query with "o "
		openViewsSubmode: () => setOpen(true), // TODO: seed query with "v "
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
					await logInfo(`palette: openView — ${viewId}`);
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
		[vaultPath, activeBuffer.filePath, commands, runtime, refresh],
	);

	// ── vim host bindings (editor ex commands) ────────────────────────────────
	const vimHostBindings = useMemo<VimHostBindings>(
		() => ({
			capture: async (kind, text) => {
				await runtime.capture(kind, text);
				await refresh();
			},
			toggleDone: async () => {
				// TODO: heading-aware TODO/DONE toggle
			},
			toggleTodo: async () => {
				// TODO: cycle todo state
			},
			schedule: async (_date) => {
				// TODO: insert SCHEDULED drawer
			},
			deadline: async (_date) => {
				// TODO: insert DEADLINE drawer
			},
			setPriority: async () => {
				// TODO: set priority cookie
			},
			addTag: async () => {
				// TODO: append tag to heading
			},
			removeTag: async () => {
				// TODO: remove tag from heading
			},
			extractRefile: async () => {
				// TODO: cut subtree and refile
			},
			openFile: async (path) => {
				const doc = await runtime.openFile(path);
				setActiveBuffer({ id: path, filePath: path, doc });
			},
			searchBlocks: async (_q) => {
				// TODO: open palette in block search mode with query seeded
				setOpen(true);
			},
			openView: async (id) => {
				await logInfo(`vimHostBindings: openView — ${id}`);
			},
			openVault: async () => {
				// TODO: open vault picker dialog
			},
			openSettings: async () => {
				// TODO: open settings panel
			},
			reindex: async () => {
				await runtime.coldIndex();
				await refresh();
			},
			saveBuffer: async () => {
				// TODO: debounced writeback
			},
			closeBuffer: async () => {
				// TODO: multi-tab close
			},
		}),
		[runtime, refresh, setOpen],
	);

	// ── layout state ──────────────────────────────────────────────────────────
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [rightWidth, setRightWidth] = useState(480);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const isMac =
				typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
			const summon = isMac ? event.metaKey : event.ctrlKey;
			if (summon && event.shiftKey && event.key.toLowerCase() === "b") {
				event.preventDefault();
				setSidebarOpen((prev) => !prev);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	// ── block details popover ─────────────────────────────────────────────────
	const [blockDetailsOpen, setBlockDetailsOpen] = useState(false);
	// TODO: cursor-aware block detection; for MVP use most-recent indexed block
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

	// ── tab switcher ──────────────────────────────────────────────────────────
	// MVP: single-element tab list derived from the active buffer.
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
						// commit — open the selected tab
						runtime
							.openFile(tab.filePath)
							.then((doc) => {
								setActiveBuffer({
									id: tab.filePath,
									filePath: tab.filePath,
									doc,
								});
							})
							.catch(() => {
								// no-op if file read fails
							});
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

	const sidebarWidth = sidebarOpen ? rightWidth : 0;

	return (
		<div
			className="grid h-dvh w-dvw bg-background text-foreground"
			style={{
				gridTemplateColumns: sidebarOpen ? `1fr 6px ${sidebarWidth}px` : "1fr",
				gridTemplateRows: "1fr 24px",
			}}
		>
			<EditorPane
				bufferId={activeBuffer.id}
				filePath={activeBuffer.filePath}
				initialDoc={activeBuffer.doc}
				vimEnabled
				vimHostBindings={vimHostBindings}
				onVimModeChange={onVimModeChange}
				onChange={() => {
					// Idle-debounced write-back wires in next slice.
				}}
				className="overflow-auto"
			/>
			{sidebarOpen ? (
				<>
					<ResizeHandle
						width={rightWidth}
						onWidthChange={setRightWidth}
						onDoubleClick={() => setSidebarOpen(false)}
					/>
					<RightSidebar blocks={blocks} onClose={() => setSidebarOpen(false)} />
				</>
			) : null}
			<StatusBar
				className={sidebarOpen ? "col-span-3" : "col-span-1"}
				vaultPath={vaultPath}
				indexStatus={`${activeBuffer.filePath} · schema v${schemaVersion ?? "?"} · ${indexNote} · ⌘K · ⌘⇧B`}
			/>
			<CommandPalette
				registry={palette}
				commandRegistry={commands}
				ctx={ctx}
				open={open}
				onClose={() => setOpen(false)}
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
							.catch(() => {
								// no-op
							});
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
