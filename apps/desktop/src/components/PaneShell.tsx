import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useSettings } from "../lib/settings-store";

interface PaneShellProps {
	/** Stable key — set on the parent via React's `key` prop too. */
	paneKey: string;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}

const ENTER = { opacity: 0, filter: "blur(14px)", scale: 0.94 };
const ACTIVE = { opacity: 1, filter: "blur(0px)", scale: 1 };

/**
 * Wraps a workspace pane in a motion.div so that mount/unmount runs a
 * blur + scale + fade pop. Honors the user's motion settings: when
 * `appearance.motionEnabled` is off, or when `respectReducedMotion` is on
 * and the OS reports `prefers-reduced-motion: reduce`, the transition
 * collapses to zero duration (no animation).
 */
export function PaneShell({
	paneKey,
	children,
	className,
	style,
}: PaneShellProps) {
	const motionEnabled = useSettings((s) => s.appearance.motionEnabled);
	const respectReducedMotion = useSettings(
		(s) => s.appearance.respectReducedMotion,
	);
	const prefersReduced = useReducedMotion();

	const animate = motionEnabled && !(respectReducedMotion && prefersReduced);
	const transition = animate
		? { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }
		: { duration: 0 };

	return (
		<motion.div
			key={paneKey}
			layout
			initial={animate ? ENTER : false}
			animate={ACTIVE}
			exit={animate ? ENTER : { opacity: 0 }}
			transition={transition}
			className={`flex min-w-[280px] flex-1 overflow-hidden ${className ?? ""}`}
			style={style}
		>
			{children}
		</motion.div>
	);
}

export { AnimatePresence };
