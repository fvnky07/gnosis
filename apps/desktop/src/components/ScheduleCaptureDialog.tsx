/**
 * Capture surface that the global `Cmd+Shift+S` shortcut and palette
 * `schedule.open` command both summon. The user types a title, picks a
 * date+time (with optional vim navigation via `Shift+H/J/K/L/W/B`), and
 * submits — the host writes the new SCHEDULED block into the picked
 * date's daily note via `runtime.captureScheduled` (created if missing).
 *
 * Design upstream: the same blocks light up automatically on the future
 * Schedule-X agenda grid (issue #15) because they flow through the same
 * indexer → ViewBlock → AgendaView pipeline.
 */

import { Button } from "@gnosis/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@gnosis/ui/components/dialog";
import { Input } from "@gnosis/ui/components/input";
import { Label } from "@gnosis/ui/components/label";
import { useEffect, useRef, useState } from "react";
import { useCalendarVimNav } from "../lib/use-calendar-vim-nav";
import {
	DateTimePicker24h,
	type DateTimePickerValue,
} from "./DateTimePicker24h";
import { Kbd } from "./SettingsControls";

export interface ScheduleSubmitInput {
	title: string;
	value: DateTimePickerValue;
}

export interface ScheduleCaptureDialogProps {
	open: boolean;
	onOpenChange(next: boolean): void;
	/** Called on Enter / Save; the dialog closes after this resolves. */
	onSubmit(input: ScheduleSubmitInput): Promise<void> | void;
	/** Optional anchor used to seed the picker on first open (defaults to now). */
	defaultDate?: Date;
}

function nextHourRoundedHalf(now: Date): Date {
	const next = new Date(now);
	next.setSeconds(0, 0);
	const minutes = next.getMinutes();
	if (minutes < 30) next.setMinutes(30);
	else {
		next.setHours(next.getHours() + 1);
		next.setMinutes(0);
	}
	return next;
}

export function ScheduleCaptureDialog({
	open,
	onOpenChange,
	onSubmit,
	defaultDate,
}: ScheduleCaptureDialogProps) {
	const [title, setTitle] = useState("");
	const [value, setValue] = useState<DateTimePickerValue | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const titleRef = useRef<HTMLInputElement | null>(null);

	// Seed picker + reset state every time the dialog opens.
	useEffect(() => {
		if (!open) return;
		const seed = defaultDate
			? { date: new Date(defaultDate), allDay: false }
			: { date: nextHourRoundedHalf(new Date()), allDay: false };
		setValue(seed);
		setTitle("");
		setSubmitting(false);
		// Defer focus so the dialog's own focus-trap doesn't steal it.
		const id = window.setTimeout(() => titleRef.current?.focus(), 30);
		return () => window.clearTimeout(id);
	}, [open, defaultDate]);

	useCalendarVimNav({
		target: contentRef.current,
		value,
		onChange: setValue,
		enabled: open,
	});

	async function commit() {
		if (submitting) return;
		const trimmed = title.trim();
		if (!trimmed || !value) return;
		setSubmitting(true);
		try {
			await onSubmit({ title: trimmed, value });
			onOpenChange(false);
		} catch (err) {
			console.error("schedule submit failed", err);
			setSubmitting(false);
		}
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey
		) {
			event.preventDefault();
			void commit();
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				ref={contentRef}
				onKeyDown={handleKeyDown}
				className="max-w-[640px] gap-4 p-0"
			>
				<DialogHeader className="px-4 pt-4">
					<DialogTitle>Schedule</DialogTitle>
					<DialogDescription>
						Drop a TODO onto a future day in your vault. Press <Kbd>⇧hjkl</Kbd>{" "}
						to navigate without lifting your hands.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 px-4 pb-3">
					<div className="flex flex-col gap-2">
						<Label htmlFor="schedule-title">Title</Label>
						<Input
							id="schedule-title"
							ref={titleRef}
							placeholder="What needs scheduling?"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>
					<DateTimePicker24h value={value} onChange={setValue} />
				</div>
				<DialogFooter className="border-t px-4 py-2 text-muted-foreground text-xs sm:justify-between">
					<div className="flex flex-wrap items-center gap-3">
						<span className="flex items-center gap-1">
							<Kbd>↵</Kbd> save
						</span>
						<span className="flex items-center gap-1">
							<Kbd>esc</Kbd> cancel
						</span>
						<span className="flex items-center gap-1">
							<Kbd>⇧H/L</Kbd> day
						</span>
						<span className="flex items-center gap-1">
							<Kbd>⇧J/K</Kbd> week
						</span>
						<span className="flex items-center gap-1">
							<Kbd>⇧W/B</Kbd> month
						</span>
					</div>
					<Button
						type="button"
						size="sm"
						disabled={!title.trim() || !value || submitting}
						onClick={() => void commit()}
					>
						{submitting ? "Saving…" : "Schedule"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
