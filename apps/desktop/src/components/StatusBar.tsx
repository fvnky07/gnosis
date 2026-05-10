interface StatusBarProps {
	/** vim mode pill content (NORMAL / INSERT / VISUAL / COMMAND / LIST / LEADER). */
	mode: string;
	/** Optional chord-in-progress like `g →` or `Space f →`. */
	chord?: string;
	/** Path of the open vault (right-anchored, truncated middle). */
	vaultPath: string;
	/** Index status text — "Indexed 1,243 · idle" or "Indexing 312 / 980". */
	indexStatus?: string;
	className?: string;
}

const MODE_COLORS: Record<string, string> = {
	NORMAL: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
	INSERT: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
	VISUAL: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
	COMMAND: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
	LIST: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
	LEADER: "bg-pink-500/20 text-pink-700 dark:text-pink-300",
	REPLACE: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
};

/**
 * The single persistent affordance for global state per
 * `planning/11-layout-and-shell.md`. 24 px tall, fixed to the bottom of
 * the shell. Right-click anywhere on it surfaces palette commands (host
 * wires that handler in the next slice).
 */
export function StatusBar({
	mode,
	chord,
	vaultPath,
	indexStatus,
	className,
}: StatusBarProps) {
	const modeClass =
		MODE_COLORS[mode.toUpperCase()] ?? "bg-muted text-muted-foreground";
	return (
		<footer
			className={`flex h-6 items-center gap-3 border-border border-t bg-background px-2 font-mono text-[11px] ${className ?? ""}`}
		>
			<span className={`rounded px-1.5 font-semibold ${modeClass}`}>
				{mode.toUpperCase()}
			</span>
			{chord ? <span className="text-muted-foreground">{chord}</span> : null}
			<span
				className="ml-auto truncate text-muted-foreground"
				title={vaultPath}
			>
				{truncateMiddle(vaultPath, 56)}
			</span>
			{indexStatus ? <span className="text-muted-foreground">·</span> : null}
			{indexStatus ? (
				<span className="text-muted-foreground">{indexStatus}</span>
			) : null}
		</footer>
	);
}

function truncateMiddle(input: string, max: number): string {
	if (input.length <= max) return input;
	const keep = Math.floor((max - 1) / 2);
	return `${input.slice(0, keep)}…${input.slice(-keep)}`;
}
