import { type Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { CodeMirrorV, ExParams } from "@replit/codemirror-vim";
import { getCM, Vim, vim } from "@replit/codemirror-vim";

export interface VimHostBindings {
	capture: (kind: "journal" | "task" | "note", text: string) => Promise<void>;
	toggleDone: () => Promise<void>;
	toggleTodo: () => Promise<void>;
	schedule: (date: string) => Promise<void>;
	deadline: (date: string) => Promise<void>;
	setPriority: (p: "A" | "B" | "C" | null) => Promise<void>;
	addTag: (tag: string) => Promise<void>;
	removeTag: (tag: string) => Promise<void>;
	extractRefile: () => Promise<void>;
	openFile: (path: string) => Promise<void>;
	searchBlocks: (q: string) => Promise<void>;
	openView: (id: string) => Promise<void>;
	openVault: () => Promise<void>;
	openSettings: () => Promise<void>;
	reindex: () => Promise<void>;
	saveBuffer: () => Promise<void>;
	closeBuffer: () => Promise<void>;
	/** Optional. When defined, the editor intercepts NORMAL-mode `:` and `/`
	 * and routes them to this binding instead of letting cm-vim show its own
	 * inline command line. The host typically opens the command palette
	 * seeded with the trigger character (so `:` opens commands, `/` opens
	 * the block search prefix). */
	openCommandLine?: (trigger: string) => void;
}

/**
 * User-tunable vim behaviors surfaced via settings. The editor package
 * stays decoupled from the persisted store — callers pass a snapshot when
 * they build the extension stack and the relevant cm-vim options + key
 * mappings are applied to the global cm-vim runtime.
 */
export interface VimOptions {
	jkEscape: boolean;
	jkTimeoutMs: number;
	relativeNumbers: boolean;
	smartCase: boolean;
	systemClipboard: boolean;
	startInNormal: boolean;
}

export const DEFAULT_VIM_OPTIONS: VimOptions = {
	jkEscape: true,
	jkTimeoutMs: 200,
	relativeNumbers: true,
	smartCase: true,
	systemClipboard: true,
	startInNormal: true,
};

let registered = false;
let appliedOptionsKey: string | null = null;

export function buildVimExtensions(
	host?: VimHostBindings,
	options: VimOptions = DEFAULT_VIM_OPTIONS,
): Extension[] {
	if (host && !registered) {
		registerExCommands(host);
		registered = true;
	}
	applyVimOptions(options);
	const extensions: Extension[] = [vim()];
	if (host?.openCommandLine) {
		extensions.push(buildCommandLineBridge(host.openCommandLine));
	}
	return extensions;
}

/**
 * Apply cm-vim runtime options derived from the user's settings. cm-vim
 * stores these globally on `Vim.options`, so we only re-apply when the
 * relevant subset changes (cheap stringified key).
 */
function applyVimOptions(options: VimOptions): void {
	const key = JSON.stringify(options);
	if (key === appliedOptionsKey) return;
	appliedOptionsKey = key;

	const setOption = (
		Vim as unknown as {
			setOption?: (name: string, value: unknown) => void;
		}
	).setOption;
	const unmap = (
		Vim as unknown as {
			unmap?: (lhs: string, mode?: string) => void;
		}
	).unmap;

	try {
		setOption?.("relativenumber", options.relativeNumbers);
		setOption?.("smartcase", options.smartCase);
		setOption?.("ignorecase", options.smartCase);
		setOption?.("clipboard", options.systemClipboard ? "unnamed" : "");
		setOption?.("timeoutlen", options.jkTimeoutMs);
	} catch {
		// cm-vim throws if an option name is unknown across versions; ignore.
	}

	try {
		unmap?.("jk", "insert");
	} catch {
		// swallow — `unmap` is best-effort
	}
	if (options.jkEscape) {
		Vim.map("jk", "<Esc>", "insert");
	}
}

/**
 * Captures NORMAL-mode `:` and `/` before cm-vim sees them and forwards to
 * the host. In INSERT/VISUAL mode the keys pass through so users can still
 * type them as characters or apply ex on a range.
 *
 * Permissive about missing vim state: if cm-vim hasn't attached its state
 * to the view yet (`getCM` returns null), we still intercept rather than
 * fall through to cm-vim's inline command line. Normal mode is the
 * default modal state, so being a beat early is safer than the user
 * seeing the wrong UI.
 */
function buildCommandLineBridge(open: (trigger: string) => void): Extension {
	const intercept =
		(trigger: string) => (view: import("@codemirror/view").EditorView) => {
			const cm = getCM(view);
			const vimSt = cm?.state?.vim as
				| { insertMode?: boolean; visualMode?: boolean }
				| undefined;
			// Only abstain when we are *certain* we're inside insert or visual
			// mode — those want the raw character. Unknown state → intercept.
			if (vimSt?.insertMode || vimSt?.visualMode) return false;
			open(trigger);
			return true;
		};
	return Prec.highest(
		keymap.of([
			{ key: ":", run: intercept(":") },
			{ key: "/", run: intercept("/") },
		]),
	);
}

function registerExCommands(host: VimHostBindings) {
	// Vim.defineEx(name, prefix, fn). fn receives (cm, params)
	// params.args is string[] — words after the command
	// params.argString is the raw arg string
	Vim.defineEx("capture", "cap", (_cm: CodeMirrorV, params: ExParams) => {
		const args: string[] = params.args ?? [];
		const kind = (args[0] ?? "note") as "journal" | "task" | "note";
		const text = args.slice(1).join(" ");
		void host.capture(kind, text);
	});
	Vim.defineEx("journal", "j", (_cm: CodeMirrorV, params: ExParams) => {
		void host.capture("journal", (params.args ?? []).join(" "));
	});
	Vim.defineEx("task", "t", (_cm: CodeMirrorV, params: ExParams) => {
		void host.capture("task", (params.args ?? []).join(" "));
	});
	Vim.defineEx("done", undefined, () => {
		void host.toggleDone();
	});
	Vim.defineEx("todo", undefined, () => {
		void host.toggleTodo();
	});
	Vim.defineEx("schedule", "sched", (_cm: CodeMirrorV, params: ExParams) => {
		void host.schedule((params.args ?? []).join(" "));
	});
	Vim.defineEx("deadline", "dead", (_cm: CodeMirrorV, params: ExParams) => {
		void host.deadline((params.args ?? []).join(" "));
	});
	Vim.defineEx("priority", "prio", (_cm: CodeMirrorV, params: ExParams) => {
		const arg = (params.args ?? [])[0] ?? null;
		const p =
			arg && /^[ABC]$/i.test(arg)
				? (arg.toUpperCase() as "A" | "B" | "C")
				: null;
		void host.setPriority(p);
	});
	Vim.defineEx("tag", undefined, (_cm: CodeMirrorV, params: ExParams) => {
		void host.addTag((params.args ?? [])[0] ?? "");
	});
	Vim.defineEx("untag", undefined, (_cm: CodeMirrorV, params: ExParams) => {
		void host.removeTag((params.args ?? [])[0] ?? "");
	});
	Vim.defineEx("extract", undefined, () => {
		void host.extractRefile();
	});
	Vim.defineEx("open", "o", (_cm: CodeMirrorV, params: ExParams) => {
		void host.openFile((params.args ?? []).join(" "));
	});
	Vim.defineEx("search", "s", (_cm: CodeMirrorV, params: ExParams) => {
		void host.searchBlocks((params.args ?? []).join(" "));
	});
	Vim.defineEx("view", "v", (_cm: CodeMirrorV, params: ExParams) => {
		void host.openView((params.args ?? [])[0] ?? "today");
	});
	Vim.defineEx("vault", undefined, () => {
		void host.openVault();
	});
	Vim.defineEx("settings", undefined, () => {
		void host.openSettings();
	});
	Vim.defineEx("reindex", undefined, () => {
		void host.reindex();
	});
	Vim.defineEx("nohl", "noh", (cm: CodeMirrorV) => {
		Vim.exitVisualMode(cm);
	});
	Vim.defineEx("q", undefined, () => {
		void host.closeBuffer();
	});
	Vim.defineEx("wq", undefined, () => {
		void host.saveBuffer();
		void host.closeBuffer();
	});
	Vim.defineEx("x", undefined, () => {
		void host.saveBuffer();
		void host.closeBuffer();
	});
}
