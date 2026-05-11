/**
 * Capture surface that the global `Cmd+Shift+S` shortcut and palette
 * `schedule.open` command both summon. The user types in **natural
 * language** ("Buy milk tomorrow at 3pm for 2h") into a single
 * palette-style input. `chrono-node` parses the temporal phrase in real
 * time and snaps the calendar + Start Time + End Time fields below to
 * match. Manual edits to those fields override the parser until the next
 * keystroke regains authority.
 *
 * Layout: a single rounded shell. Top row is the natural-language input.
 * The bottom is one bordered, rounded container holding the calendar,
 * Start/End time inputs, and the keyboard-shortcut chips — all the same
 * width so the dialog reads as one cohesive surface (no nested Card).
 *
 * On submit (Cmd/Ctrl + Enter, or the Schedule button) the host writes
 * the new SCHEDULED block into the picked date's daily note via
 * `runtime.captureScheduled` (created if missing). When chrono extracted
 * (or the user supplied) a same-day end time the SCHEDULED line uses the
 * org range form `<2026-05-15 Fri 09:00-10:00>`.
 *
 * Design upstream: the same blocks light up automatically on the future
 * Schedule-X agenda grid (issue #15) because they flow through the same
 * indexer → ViewBlock → AgendaView pipeline.
 */

import { Button } from "@gnosis/ui/components/button";
import { Calendar } from "@gnosis/ui/components/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@gnosis/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@gnosis/ui/components/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@gnosis/ui/components/input-group";
import { Clock2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCalendarVimNav } from "../lib/use-calendar-vim-nav";
import { useNaturalSchedule } from "../lib/use-natural-schedule";
import { Kbd } from "./SettingsControls";

export interface ScheduleSubmitInput {
	title: string;
	value: { date: Date; endDate: Date | null; allDay: boolean };
}

export interface ScheduleCaptureDialogProps {
	open: boolean;
	onOpenChange(next: boolean): void;
	/** Called on Enter / Save; the dialog closes after this resolves. */
	onSubmit(input: ScheduleSubmitInput): Promise<void> | void;
	/** Optional anchor used to seed the picker on first open (defaults to now). */
	defaultDate?: Date;
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
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

function formatHHMM(date: Date | null): string {
	if (!date) return "";
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function applyHHMM(base: Date, hhmm: string): Date {
	const [hRaw, mRaw] = hhmm.split(":");
	const h = Number.parseInt(hRaw ?? "", 10);
	const m = Number.parseInt(mRaw ?? "", 10);
	const next = new Date(base);
	if (!Number.isNaN(h)) next.setHours(h);
	if (!Number.isNaN(m)) next.setMinutes(m);
	next.setSeconds(0, 0);
	return next;
}

function mergeDateKeepTime(dayOnly: Date, source: Date): Date {
	const next = new Date(dayOnly);
	next.setHours(source.getHours());
	next.setMinutes(source.getMinutes());
	next.setSeconds(0, 0);
	return next;
}

function addMinutes(date: Date | null, minutes: number): Date | null {
	if (!date) return null;
	const next = new Date(date);
	next.setMinutes(next.getMinutes() + minutes);
	return next;
}

const SUMMARY_FMT = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	month: "short",
	day: "numeric",
});

function formatSummary(state: {
	start: Date | null;
	end: Date | null;
	allDay: boolean;
}): string {
	if (!state.start) return "";
	const day = SUMMARY_FMT.format(state.start);
	if (state.allDay) return `${day} · all day`;
	const start = formatHHMM(state.start);
	if (state.end) return `${day} · ${start} → ${formatHHMM(state.end)}`;
	return `${day} · ${start}`;
}

export function ScheduleCaptureDialog({
	open,
	onOpenChange,
	onSubmit,
	defaultDate,
}: ScheduleCaptureDialogProps) {
	const [submitting, setSubmitting] = useState(false);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	// `seed` recomputes on every open so the dialog reflects the moment the
	// user summoned it rather than the moment the host first mounted.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `open` is the trigger; defaultDate optionally pins it
	const seed = useMemo(
		() => defaultDate ?? nextHourRoundedHalf(new Date()),
		[defaultDate, open],
	);

	const sched = useNaturalSchedule({ seed, enabled: open });

	useEffect(() => {
		if (!open) {
			setSubmitting(false);
			return;
		}
		// Defer focus so the dialog's own focus-trap doesn't steal it.
		const id = window.setTimeout(() => inputRef.current?.focus(), 30);
		return () => window.clearTimeout(id);
	}, [open]);

	useCalendarVimNav({
		target: contentRef.current,
		value: sched.start ? { date: sched.start, allDay: sched.allDay } : null,
		onChange: (next) => sched.setStart(next.date),
		enabled: open,
	});

	async function commit() {
		if (submitting) return;
		const trimmed = sched.title.trim();
		if (!trimmed || !sched.start) return;
		setSubmitting(true);
		try {
			await onSubmit({
				title: trimmed,
				value: {
					date: sched.start,
					endDate: sched.end,
					allDay: sched.allDay,
				},
			});
			onOpenChange(false);
		} catch (err) {
			console.error("schedule submit failed", err);
			setSubmitting(false);
		}
	}

	function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		// Cmd/Ctrl+Enter commits regardless of which inner control has focus.
		// Bare Enter inside time inputs would otherwise reset values on some
		// browsers, so we deliberately gate on the modifier.
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void commit();
		}
	}

	function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		// The NL input also accepts plain Enter — palette muscle memory —
		// since `<input>` doesn't reinterpret Enter the way time inputs do.
		if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
			event.preventDefault();
			void commit();
		}
	}

	const summary = formatSummary(sched);
	const hasTitle = sched.title.trim().length > 0;
	const hasStart = sched.start != null;
	const submitDisabled = !hasTitle || !hasStart || submitting;
	const summaryHint = !hasStart
		? "add a date"
		: !hasTitle
			? "add a title"
			: summary;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				ref={contentRef}
				onKeyDown={handleDialogKeyDown}
				showCloseButton={false}
				className="max-w-[440px] gap-0 overflow-hidden rounded-xl bg-background p-0"
			>
				{/* Title + description live for assistive tech only — the visual
				    surface is just the input + calendar (per request). Esc still
				    closes the dialog via Radix's built-in handler. */}
				<DialogHeader className="sr-only">
					<DialogTitle>Schedule</DialogTitle>
					<DialogDescription>
						Type a schedule in natural language. Press ⌘↵ to save, Esc to
						cancel.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2 p-2">
					<InputGroup className="h-9 rounded-md">
						<InputGroupInput
							ref={inputRef}
							placeholder="Try: tomorrow at 3pm for 2h"
							value={sched.inputText}
							onChange={(e) => sched.setInputText(e.target.value)}
							onKeyDown={handleInputKeyDown}
						/>
						<InputGroupAddon align="inline-end">
							<span
								className={
									!hasStart || !hasTitle
										? "text-muted-foreground text-xs"
										: "text-xs"
								}
							>
								{summaryHint}
							</span>
						</InputGroupAddon>
					</InputGroup>

					<div className="flex flex-col rounded-md border bg-card">
						{/*
						 * Calendar fills the container width via the `root: "w-full"`
						 * override. We deliberately do NOT touch `month` or `months`
						 * so they keep their default `relative flex flex-col` —
						 * the month nav (`<` / `>`) is `absolute top-0`, which
						 * anchors to the closest `position:relative` ancestor
						 * (`months`); stripping `relative` from `months` made the
						 * chevrons escape the calendar and land at the dialog top.
						 *
						 * The day cells drop `aspect-square` (→ `aspect-auto`) and
						 * pin an explicit `h-10` so six-week months stop overflowing
						 * the calendar's allocated height into the Start/End time
						 * row below.
						 */}
						<Calendar
							mode="single"
							selected={sched.start ?? undefined}
							month={sched.start ?? seed}
							onSelect={(d) => {
								if (d)
									sched.setStart(mergeDateKeepTime(d, sched.start ?? seed));
							}}
							onMonthChange={(m) =>
								sched.setStart(mergeDateKeepTime(m, sched.start ?? seed))
							}
							className="w-full p-3"
							classNames={{
								root: "w-full",
								day: "aspect-auto h-10 w-full p-0",
								day_button: "size-full min-w-0",
							}}
						/>
						<div className="flex flex-col gap-2 border-t bg-card p-3">
							<FieldGroup className="grid grid-cols-2 gap-2">
								<Field>
									<FieldLabel htmlFor="schedule-time-from">
										Start Time
									</FieldLabel>
									<InputGroup className="h-9 rounded-md">
										<InputGroupInput
											id="schedule-time-from"
											type="time"
											step={60}
											value={formatHHMM(sched.start)}
											onChange={(e) =>
												sched.setStart(
													applyHHMM(sched.start ?? seed, e.target.value),
												)
											}
											className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
										/>
										<InputGroupAddon>
											<Clock2Icon className="text-muted-foreground" />
										</InputGroupAddon>
									</InputGroup>
								</Field>
								<Field>
									<FieldLabel htmlFor="schedule-time-to">End Time</FieldLabel>
									<InputGroup className="h-9 rounded-md">
										<InputGroupInput
											id="schedule-time-to"
											type="time"
											step={60}
											value={formatHHMM(
												sched.end ?? addMinutes(sched.start, 60),
											)}
											onChange={(e) =>
												sched.setEnd(
													applyHHMM(sched.start ?? seed, e.target.value),
												)
											}
											className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
										/>
										<InputGroupAddon>
											<Clock2Icon className="text-muted-foreground" />
										</InputGroupAddon>
									</InputGroup>
								</Field>
							</FieldGroup>
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-muted-foreground text-xs">
								<span className="flex items-center gap-1">
									<Kbd>⌘↵</Kbd> save
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
						</div>
					</div>
				</div>

				<DialogFooter className="border-t bg-card px-3 py-2 sm:justify-end">
					<Button
						type="button"
						size="sm"
						disabled={submitDisabled}
						onClick={() => void commit()}
						className="rounded-md"
					>
						{submitting ? "Saving…" : "Schedule"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
