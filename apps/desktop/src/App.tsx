import { useEffect, useState } from "react";
import { EditorPane } from "./EditorPane";
import { openDb, readSchemaVersion } from "./lib/db";
import { error as logError, info as logInfo } from "./lib/log";
import { ensureVaultPath } from "./lib/vault";

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

const SAMPLE_ORG = `#+TITLE: Welcome to gnosis

* TODO try vim
:PROPERTIES:
:ID:       01J9DEMO0001
:END:
SCHEDULED: <2026-05-10 Sun>
press \`Esc\` then \`i\` to enter INSERT mode and edit. Use \`:\` for ex commands.

* DONE [#A] sanity check :demo:
:PROPERTIES:
:ID:       01J9DEMO0002
:END:
this is a static demo doc. file IO and indexer wiring land in the next slice.

** child block :nested:
tag inheritance demo
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
			<div className="flex h-dvh w-dvw flex-col bg-background text-foreground">
				<header className="flex items-baseline justify-between border-border border-b px-4 py-2 text-xs">
					<span className="font-semibold">gnosis</span>
					<span className="text-muted-foreground">
						<code className="font-mono">{status.vaultPath}</code>
						{" · "}
						schema v{status.schemaVersion ?? "?"}
					</span>
				</header>
				<EditorPane
					bufferId="demo"
					filePath="demo.org"
					initialDoc={SAMPLE_ORG}
					vimEnabled
					onChange={() => {
						// File-IO write-back wires up in the next slice.
					}}
					className="flex-1 overflow-auto"
				/>
			</div>
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
