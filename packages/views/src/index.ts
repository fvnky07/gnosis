export const PACKAGE = "@gnosis/views";

export { AgendaView } from "./components/AgendaView";
export { JournalView } from "./components/JournalView";
export { TodosView } from "./components/TodosView";
export {
	type AgendaMode,
	type AgendaRange,
	type AgendaSlot,
	computeAgenda,
} from "./lib/agenda";
export {
	filterJournalBlocks,
	groupJournalBlocksByDay,
} from "./lib/journal";
export {
	dayDiff,
	parseOrgDate,
	relativeDate,
	startOfDay,
} from "./lib/relative-date";
export {
	buildKanbanColumns,
	classifyKanban,
	type KanbanColumn,
	type KanbanColumnId,
	sortTodosListMode,
} from "./lib/todos";
export type { OnOpenBlock, ViewBlock } from "./types";
