export interface LeaderEntry {
	chord: string[];
	label: string;
	action:
		| { kind: "palette"; mode?: string }
		| { kind: "capture"; preset: "journal" | "task" | "note" }
		| { kind: "blockDetails" }
		| { kind: "outline" }
		| { kind: "view"; submode: true };
}

export const LEADER_MAP: LeaderEntry[] = [
	{ chord: [" "], label: "palette", action: { kind: "palette" } },
	{
		chord: ["j"],
		label: "journal",
		action: { kind: "capture", preset: "journal" },
	},
	{
		chord: ["t"],
		label: "task",
		action: { kind: "capture", preset: "task" },
	},
	{
		chord: ["n"],
		label: "note",
		action: { kind: "capture", preset: "note" },
	},
	{
		chord: ["f"],
		label: "file search",
		action: { kind: "palette", mode: "f" },
	},
	{
		chord: ["b"],
		label: "block search",
		action: { kind: "palette", mode: "b" },
	},
	{ chord: ["o"], label: "outline", action: { kind: "outline" } },
	{ chord: ["i"], label: "block details", action: { kind: "blockDetails" } },
	{ chord: ["v"], label: "views", action: { kind: "view", submode: true } },
];

export function lookupLeader(chord: string[]): LeaderEntry | undefined {
	return LEADER_MAP.find((e) => sameChord(e.chord, chord));
}

export function partialLeaderMatches(chord: string[]): LeaderEntry[] {
	return LEADER_MAP.filter((e) => startsWith(e.chord, chord));
}

function sameChord(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((k, i) => k === b[i]);
}

function startsWith(full: string[], prefix: string[]): boolean {
	if (prefix.length > full.length) return false;
	return prefix.every((k, i) => full[i] === k);
}
