import type { ReactNode } from "react";

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	body?: string;
	cta?: ReactNode;
	className?: string;
}

/**
 * Uniform empty card across the views per
 * `planning/16-design-system.md#empty-states`. Pure presentation — the
 * caller decides what icon to render and what CTA to show.
 */
export function EmptyState({
	icon,
	title,
	body,
	cta,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={`flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className ?? ""}`}
		>
			{icon ? <div className="opacity-50">{icon}</div> : null}
			<div className="font-semibold text-base text-foreground">{title}</div>
			{body ? (
				<p className="max-w-sm text-muted-foreground text-sm">{body}</p>
			) : null}
			{cta ? (
				<div className="mt-2 text-muted-foreground text-xs">{cta}</div>
			) : null}
		</div>
	);
}
