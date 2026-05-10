import { useVimRuntime, type VimMode } from "./store";

const MODE_STYLES: Record<VimMode, { label: string; className: string }> = {
	NORMAL: { label: "NORMAL", className: "bg-blue-600 text-white" },
	INSERT: { label: "INSERT", className: "bg-green-600 text-white" },
	VISUAL: { label: "VISUAL", className: "bg-amber-500 text-black" },
	REPLACE: { label: "REPLACE", className: "bg-red-600 text-white" },
	COMMAND: { label: "COMMAND", className: "bg-purple-600 text-white" },
	LIST: { label: "LIST", className: "bg-gray-500 text-white" },
	LEADER: { label: "LEADER", className: "bg-gray-500 text-white underline" },
};

export function ModePill({ className = "" }: { className?: string }) {
	const mode = useVimRuntime((s) => s.mode);
	const leaderActive = useVimRuntime((s) => s.leaderActive);
	const display: VimMode = leaderActive ? "LEADER" : mode;
	const style = MODE_STYLES[display];
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${style.className} ${className}`}
		>
			{style.label}
		</span>
	);
}
