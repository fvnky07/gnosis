import {
	type CalendarEvent,
	createViewDay,
	createViewMonthGrid,
	createViewWeek,
} from "@schedule-x/calendar";
import { createCurrentTimePlugin } from "@schedule-x/current-time";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { ScheduleXCalendar, useCalendarApp } from "@schedule-x/react";
import "@schedule-x/theme-default/dist/calendar.css";
import { useEffect, useMemo, useState } from "react";
import {
	type ScheduleXEvent,
	viewBlocksToScheduleXEvents,
} from "../lib/schedule-x-adapter";
import type { OnOpenBlock, ViewBlock } from "../types";

export type AgendaCalendarMode = "day" | "week" | "month";

interface AgendaCalendarProps {
	blocks: ViewBlock[];
	defaultMode?: AgendaCalendarMode;
	onOpenBlock?: OnOpenBlock;
}

const MODE_TO_VIEW_NAME: Record<AgendaCalendarMode, string> = {
	day: "day",
	week: "week",
	month: "month-grid",
};

/**
 * Schedule-X calendar wrapped in our theming + click-handling. Owns the
 * `useCalendarApp` instance, the events-service plugin (so we can re-feed
 * events without recreating the app), and a MutationObserver that mirrors
 * `<html class="dark">` into Schedule-X's theme. Modifier-key passthrough
 * on chip click is limited by Schedule-X's `onEventClick` signature, so we
 * always pass `{ newTab: false }` for now.
 */
export function AgendaCalendar({
	blocks,
	defaultMode = "week",
	onOpenBlock,
}: AgendaCalendarProps) {
	const [isDark, setIsDark] = useState<boolean>(detectDark);

	useEffect(() => {
		if (typeof document === "undefined") return;
		const target = document.documentElement;
		const update = () => setIsDark(target.classList.contains("dark"));
		update();
		const observer = new MutationObserver(update);
		observer.observe(target, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, []);

	const eventsService = useMemo(() => createEventsServicePlugin(), []);
	const currentTime = useMemo(() => createCurrentTimePlugin(), []);

	// Snapshot events on first render; subsequent block changes flow through
	// `eventsService.set()` below so the calendar instance is stable.
	const initialEvents = useMemo(
		() => viewBlocksToScheduleXEvents(blocks),
		// biome-ignore lint/correctness/useExhaustiveDependencies: initial only
		[],
	);

	const calendar = useCalendarApp(
		{
			views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
			events: initialEvents as unknown as CalendarEvent[],
			defaultView: MODE_TO_VIEW_NAME[defaultMode],
			isDark,
			callbacks: {
				onEventClick: (event) => {
					const sourceBlock = (event as ScheduleXEvent)._block;
					if (sourceBlock) onOpenBlock?.(sourceBlock, { newTab: false });
				},
			},
		},
		[eventsService, currentTime],
	);

	useEffect(() => {
		if (!calendar) return;
		const fresh = viewBlocksToScheduleXEvents(blocks);
		eventsService.set(fresh as unknown as CalendarEvent[]);
	}, [blocks, calendar, eventsService]);

	useEffect(() => {
		if (!calendar) return;
		calendar.setTheme(isDark ? "dark" : "light");
	}, [calendar, isDark]);

	return (
		<div className="flex h-full min-h-0 w-full flex-col">
			<ScheduleXCalendar calendarApp={calendar} />
		</div>
	);
}

function detectDark(): boolean {
	if (typeof document === "undefined") return false;
	return document.documentElement.classList.contains("dark");
}
