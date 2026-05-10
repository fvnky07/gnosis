import { ModePill } from "@gnosis/vim-runtime";

interface StatusBarProps {
	/** Path of the open vault (right-anchored, truncated middle). */
	vaultPath: string;
	/** Index status text — "Indexed 1,243 · idle" or "Indexing 312 / 980". */
	indexStatus?: string;
	className?: string;
}

/**
 * The single persistent affordance for global state per
 * `planning/11-layout-and-shell.md`. 24 px tall, fixed to the bottom of
 * the shell. Right-click anywhere on it surfaces palette commands (host
 * wires that handler in the next slice).
 *
 * Mode display is delegated to `<ModePill />` from `@gnosis/vim-runtime`
 * so it stays in sync with the global vim store automatically.
 */
export function StatusBar({
	vaultPath,
	indexStatus,
	className,
}: StatusBarProps) {
	return (
		<footer
			className={`flex h-6 items-center gap-3 border-border border-t bg-background px-2 font-mono text-[11px] ${className ?? ""}`}
		>
			<ModePill />
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
