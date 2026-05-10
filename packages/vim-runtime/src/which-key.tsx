import { useEffect, useState } from "react";
import { LEADER_MAP, partialLeaderMatches } from "./leader";
import { useVimRuntime } from "./store";

const POPUP_DELAY_MS = 300;

export function WhichKeyOverlay() {
	const leaderActive = useVimRuntime((s) => s.leaderActive);
	const leaderStartedAt = useVimRuntime((s) => s.leaderStartedAt);
	const chord = useVimRuntime((s) => s.chord);

	if (!leaderActive || !leaderStartedAt) return null;
	if (Date.now() - leaderStartedAt < POPUP_DELAY_MS) {
		// Still inside the buffer window. Render a no-op div that schedules a re-render.
		return <DelayedRender startedAt={leaderStartedAt} />;
	}

	const remaining =
		chord.length === 0 ? LEADER_MAP : partialLeaderMatches(chord);

	return (
		<div
			role="dialog"
			aria-label="Leader key options"
			className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
		>
			<div className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
				SPC {chord.join(" ")}
			</div>
			<ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
				{remaining.map((entry) => (
					<li key={entry.chord.join("-")}>
						<span className="mr-2 inline-block w-4 text-primary">
							{entry.chord[chord.length] ?? "·"}
						</span>
						<span>{entry.label}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function DelayedRender({ startedAt }: { startedAt: number }) {
	// Force a re-render after the buffer window so the popup appears.
	const [, setTick] = useState(0);
	useEffect(() => {
		const remaining = POPUP_DELAY_MS - (Date.now() - startedAt);
		if (remaining <= 0) return;
		const id = setTimeout(() => setTick((n) => n + 1), remaining);
		return () => clearTimeout(id);
	}, [startedAt]);
	return null;
}
