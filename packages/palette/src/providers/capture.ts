import type { PaletteProvider } from "../types";

/**
 * Capture provider: `j foo`, `t foo tomorrow`, `n foo`. Each prefix maps to
 * a different executor on the host's `PaletteExecutors`. The provider
 * itself doesn't touch the vault — the executor (e.g. `captureJournal`)
 * does, calling `@gnosis/core` `emitAppendBlock` and writing through the
 * vault adapter.
 *
 * Tests pass mock executors to assert wiring.
 */
export const captureProvider: PaletteProvider = {
	id: "capture",
	scope: ["root", "capture"],
	rank: 5,
	match(query) {
		return /^[jtn]\s/.test(query);
	},
	async results(query, _signal, _ctx) {
		const prefix = query[0];
		const text = query.slice(2);
		if (text.length === 0) return [];
		switch (prefix) {
			case "j":
				return [
					{
						id: "capture.journal",
						label: `Journal: ${text}`,
						detail: ":journal: → today's daily note",
						meta: { kind: "journal", text },
					},
				];
			case "t":
				return [
					{
						id: "capture.task",
						label: `Task: ${text}`,
						detail: "* TODO with SCHEDULED → today's daily note",
						meta: { kind: "task", text },
					},
				];
			case "n":
				return [
					{
						id: "capture.note",
						label: `Note: ${text}`,
						detail: "Untagged heading → today's daily note",
						meta: { kind: "note", text },
					},
				];
			default:
				return [];
		}
	},
	async onSubmit(item, ctx) {
		const kind = item.meta?.kind as string | undefined;
		const text = item.meta?.text as string | undefined;
		if (!kind || !text) return;
		switch (kind) {
			case "journal":
				await ctx.exec.captureJournal(text);
				break;
			case "task":
				await ctx.exec.captureTask(text);
				break;
			case "note":
				await ctx.exec.captureNote(text);
				break;
		}
	},
};
