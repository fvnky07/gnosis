import { CommandPalette, type PaletteCtx } from "@gnosis/palette";
import type { ViewBlock } from "@gnosis/views";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResizeHandle } from "./components/ResizeHandle";
import { RightSidebar } from "./components/RightSidebar";
import { StatusBar } from "./components/StatusBar";
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
	const { palette, commands, open, setOpen } = usePaletteEngine();
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

	const ctx = useMemo<PaletteCtx>(
		() => ({
			vaultRoot: vaultPath,
			activeFilePath: null,
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
			},
		}),
		// `commands` and `runtime` are stable across renders; `refresh` is
		// memoized on `runtime`. vaultPath changes only when the user re-picks.
		// biome-ignore lint/correctness/useExhaustiveDependencies: see comment
		[vaultPath, commands, runtime, refresh],
	);

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
				mode="INSERT"
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
