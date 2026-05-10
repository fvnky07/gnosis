/**
 * Subset of `@gnosis/db`'s `Block` row shape that the view layer cares
 * about. Components take this as a prop instead of querying SQL directly,
 * which keeps the views renderable in tests / Storybook and lets the host
 * decide its own fetching strategy.
 */
export interface ViewBlock {
	id: string;
	filePath: string;
	level: number;
	headlineRaw: string;
	body: string;
	todoState: "TODO" | "DONE" | null;
	priority: "A" | "B" | "C" | null;
	scheduled: string | null;
	deadline: string | null;
	closed: string | null;
	/**
	 * `created_ms` if the schema tracks it; otherwise the indexer can pass the
	 * file's mtime as a proxy. Used by the journal feed grouping.
	 */
	createdMs?: number;
	tags: string[];
}

/**
 * Callback the host wires into views — clicking a card jumps the editor to
 * the source block. The host decides whether to open in the current tab or
 * a new one based on modifier keys.
 */
export type OnOpenBlock = (
	block: ViewBlock,
	options?: { newTab?: boolean },
) => void;
