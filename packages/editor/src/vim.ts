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

let registered = false;

export function buildVimExtensions(host?: VimHostBindings): Extension[] {
	if (host && !registered) {
		registerExCommands(host);
		registered = true;
	}
	const extensions: Extension[] = [vim()];
	if (host?.openCommandLine) {
		extensions.push(buildCommandLineBridge(host.openCommandLine));
	}
	return extensions;
}

/**
 * Captures NORMAL-mode `:` and `/` before cm-vim sees them and forwards to
 * the host. In INSERT/VISUAL mode the keys pass through so users can still
 * type them as characters or apply ex on a range.
 */
function buildCommandLineBridge(open: (trigger: string) => void): Extension {
	const intercept =
		(trigger: string) => (view: import("@codemirror/view").EditorView) => {
			const cm = getCM(view);
			const vimSt = cm?.state?.vim as
				| { insertMode?: boolean; visualMode?: boolean }
				| undefined;
			if (!vimSt) return false;
			if (vimSt.insertMode || vimSt.visualMode) return false;
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
