/**
 * Inline date + 24h time picker used by `ScheduleCaptureDialog`. Adapted
 * from the canonical shadcn `DateTimePicker24h` block (ui.shadcn.com/blocks)
 * with three changes for this codebase:
 *
 *   1. Imports use the `@gnosis/ui` workspace aliases (no `@/components`).
 *   2. The display label is formatted via `Intl.DateTimeFormat` instead of
 *      pulling `date-fns` into the desktop bundle.
 *   3. The control is fully controlled via `value` / `onChange` so the
 *      surrounding dialog owns state — vim navigation lives outside this
 *      component and mutates `value`.
 *
 * An "All day" switch hides the time scrollers and the time component is
 * dropped from the org SCHEDULED line at submit.
 */

import { Button } from "@gnosis/ui/components/button";
import { Calendar } from "@gnosis/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@gnosis/ui/components/popover";
import { ScrollArea, ScrollBar } from "@gnosis/ui/components/scroll-area";
import { Switch } from "@gnosis/ui/components/switch";
import { cn } from "@gnosis/ui/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

const LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
	month: "2-digit",
	day: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});
const ALL_DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
	month: "2-digit",
	day: "2-digit",
	year: "numeric",
});

function formatPickerLabel(date: Date, allDay: boolean): string {
	return allDay ? ALL_DAY_FORMATTER.format(date) : LABEL_FORMATTER.format(date);
}

export interface DateTimePickerValue {
	date: Date;
	allDay: boolean;
}

export interface DateTimePicker24hProps {
	value: DateTimePickerValue | null;
	onChange: (next: DateTimePickerValue) => void;
	className?: string;
	/**
	 * Anchor for the popover and key target for vim-navigation. The dialog
	 * forwards `Shift+H/J/K/L/W/B` keydown handling here and uses this id to
	 * scope listeners.
	 */
	id?: string;
}

export function DateTimePicker24h({
	value,
	onChange,
	className,
	id,
}: DateTimePicker24hProps) {
	const [open, setOpen] = useState(false);

	function handleDateSelect(selected: Date | undefined) {
		if (!selected) return;
		const merged = new Date(selected);
		if (value) {
			merged.setHours(value.date.getHours());
			merged.setMinutes(value.date.getMinutes());
		}
		onChange({ date: merged, allDay: value?.allDay ?? false });
	}

	function handleTimeChange(part: "hour" | "minute", raw: string) {
		const base = value?.date ?? new Date();
		const next = new Date(base);
		const n = Number.parseInt(raw, 10);
		if (Number.isNaN(n)) return;
		if (part === "hour") next.setHours(n);
		else next.setMinutes(n);
		next.setSeconds(0, 0);
		onChange({ date: next, allDay: false });
	}

	function handleAllDay(allDay: boolean) {
		const base = value?.date ?? new Date();
		const next = new Date(base);
		if (allDay) next.setHours(0, 0, 0, 0);
		onChange({ date: next, allDay });
	}

	const label = value
		? formatPickerLabel(value.date, value.allDay)
		: "MM/DD/YYYY hh:mm";

	return (
		<div className={cn("flex flex-col gap-2", className)} id={id}>
			<div className="flex items-center justify-between gap-3">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						render={(props) => (
							<Button
								variant="outline"
								className={cn(
									"w-full justify-start text-left font-normal",
									!value && "text-muted-foreground",
								)}
								{...props}
							>
								<CalendarIcon className="mr-2 size-4" />
								{label}
							</Button>
						)}
					/>
					<PopoverContent
						className="w-auto p-0"
						align="start"
						data-schedule-popover
					>
						<div className="sm:flex">
							<Calendar
								mode="single"
								selected={value?.date}
								onSelect={handleDateSelect}
								month={value?.date}
								onMonthChange={(month) => {
									if (!value) {
										onChange({ date: month, allDay: false });
										return;
									}
									const next = new Date(value.date);
									next.setFullYear(month.getFullYear());
									next.setMonth(month.getMonth());
									onChange({ date: next, allDay: value.allDay });
								}}
								autoFocus
							/>
							{value?.allDay ? null : (
								<div className="flex h-[300px] flex-col divide-x sm:flex-row sm:divide-x">
									<ScrollArea className="w-16">
										<div className="flex gap-1 p-2 sm:flex-col">
											{HOURS.map((hour) => (
												<Button
													key={hour}
													size="icon"
													variant={
														value && value.date.getHours() === hour
															? "default"
															: "ghost"
													}
													className="aspect-square shrink-0 sm:w-full"
													onClick={() =>
														handleTimeChange("hour", hour.toString())
													}
												>
													{hour.toString().padStart(2, "0")}
												</Button>
											))}
										</div>
										<ScrollBar orientation="horizontal" className="sm:hidden" />
									</ScrollArea>
									<ScrollArea className="w-16">
										<div className="flex gap-1 p-2 sm:flex-col">
											{MINUTES.map((minute) => (
												<Button
													key={minute}
													size="icon"
													variant={
														value && value.date.getMinutes() === minute
															? "default"
															: "ghost"
													}
													className="aspect-square shrink-0 sm:w-full"
													onClick={() =>
														handleTimeChange("minute", minute.toString())
													}
												>
													{minute.toString().padStart(2, "0")}
												</Button>
											))}
										</div>
										<ScrollBar orientation="horizontal" className="sm:hidden" />
									</ScrollArea>
								</div>
							)}
						</div>
					</PopoverContent>
				</Popover>
				<label className="flex items-center gap-2 whitespace-nowrap text-muted-foreground text-xs">
					<Switch
						checked={value?.allDay ?? false}
						onCheckedChange={handleAllDay}
					/>
					All day
				</label>
			</div>
		</div>
	);
}
