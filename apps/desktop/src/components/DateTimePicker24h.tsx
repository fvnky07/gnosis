/**
 * Inline date + 24h time picker used by `ScheduleCaptureDialog`. The
 * canonical shadcn `DateTimePicker24h` block wraps the calendar in a
 * popover; we render it inline so the calendar is visible the moment the
 * dialog opens — no extra click required.
 *
 * Three deltas from the canonical block:
 *   1. No popover wrapper. Calendar is always visible.
 *   2. Imports use the `@gnosis/ui` workspace aliases.
 *   3. The control is fully controlled via `value` / `onChange` so the
 *      surrounding dialog owns state — vim navigation lives outside this
 *      component and mutates `value`.
 *
 * An "All day" toggle hides the time scrollers and the time component is
 * dropped from the org SCHEDULED line at submit.
 */

import { Button } from "@gnosis/ui/components/button";
import { Calendar } from "@gnosis/ui/components/calendar";
import { Label } from "@gnosis/ui/components/label";
import { ScrollArea, ScrollBar } from "@gnosis/ui/components/scroll-area";
import { Switch } from "@gnosis/ui/components/switch";
import { cn } from "@gnosis/ui/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export interface DateTimePickerValue {
	date: Date;
	allDay: boolean;
}

export interface DateTimePicker24hProps {
	value: DateTimePickerValue | null;
	onChange: (next: DateTimePickerValue) => void;
	className?: string;
}

export function DateTimePicker24h({
	value,
	onChange,
	className,
}: DateTimePicker24hProps) {
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

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<Label className="flex items-center justify-between text-muted-foreground">
				<span>When</span>
				<span className="flex items-center gap-2">
					<Switch
						checked={value?.allDay ?? false}
						onCheckedChange={handleAllDay}
					/>
					All day
				</span>
			</Label>
			<div className="flex flex-col rounded-md border border-border sm:flex-row sm:divide-x">
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
					<div className="flex h-[280px] divide-x sm:divide-x">
						<ScrollArea className="w-16">
							<div className="flex flex-col gap-1 p-1">
								{HOURS.map((hour) => (
									<Button
										key={hour}
										size="icon"
										variant={
											value && value.date.getHours() === hour
												? "default"
												: "ghost"
										}
										className="aspect-square w-full shrink-0"
										onClick={() => handleTimeChange("hour", hour.toString())}
									>
										{hour.toString().padStart(2, "0")}
									</Button>
								))}
							</div>
							<ScrollBar orientation="vertical" />
						</ScrollArea>
						<ScrollArea className="w-16">
							<div className="flex flex-col gap-1 p-1">
								{MINUTES.map((minute) => (
									<Button
										key={minute}
										size="icon"
										variant={
											value && value.date.getMinutes() === minute
												? "default"
												: "ghost"
										}
										className="aspect-square w-full shrink-0"
										onClick={() =>
											handleTimeChange("minute", minute.toString())
										}
									>
										{minute.toString().padStart(2, "0")}
									</Button>
								))}
							</div>
							<ScrollBar orientation="vertical" />
						</ScrollArea>
					</div>
				)}
			</div>
		</div>
	);
}
