import type { ViewKind } from "../components/ViewCard";

/**
 * Layout tree for the workspace. Leaves are content slots (the editor or a
 * view); splits are oriented groups (horizontal = side-by-side, vertical =
 * stacked). The renderer maps a split to a `<PanelGroup>` and a leaf to a
 * `<Panel>` from react-resizable-panels.
 *
 * The root is always a horizontal split so opening a new view can append to
 * it without re-parenting the editor leaf. The editor leaf is never removed.
 */

export type LeafView = "editor" | ViewKind;
export type SplitDirection = "horizontal" | "vertical";

export interface PaneLeaf {
	kind: "leaf";
	id: string;
	view: LeafView;
}

export interface PaneSplit {
	kind: "split";
	id: string;
	direction: SplitDirection;
	children: PaneNode[];
	/**
	 * Last-known panel sizes in percent (sum to ~100). Optional because a
	 * freshly created split defaults to an equal share.
	 */
	sizes?: number[];
}

export type PaneNode = PaneLeaf | PaneSplit;

export const EDITOR_LEAF_ID = "leaf-editor";
export const ROOT_SPLIT_ID = "root";

let leafCounter = 0;
function nextLeafId(view: LeafView): string {
	if (view === "editor") return EDITOR_LEAF_ID;
	leafCounter += 1;
	return `leaf-${view}-${Date.now().toString(36)}-${leafCounter}`;
}

let splitCounter = 0;
function nextSplitId(direction: SplitDirection): string {
	splitCounter += 1;
	return `split-${direction[0]}-${Date.now().toString(36)}-${splitCounter}`;
}

export function defaultPaneTree(): PaneSplit {
	return {
		kind: "split",
		id: ROOT_SPLIT_ID,
		direction: "horizontal",
		children: [{ kind: "leaf", id: EDITOR_LEAF_ID, view: "editor" }],
	};
}

export function isLeaf(node: PaneNode): node is PaneLeaf {
	return node.kind === "leaf";
}

export function isSplit(node: PaneNode): node is PaneSplit {
	return node.kind === "split";
}

export function findLeafByView(
	root: PaneNode,
	view: LeafView,
): PaneLeaf | null {
	if (isLeaf(root)) return root.view === view ? root : null;
	for (const child of root.children) {
		const hit = findLeafByView(child, view);
		if (hit) return hit;
	}
	return null;
}

export function findLeafById(root: PaneNode, id: string): PaneLeaf | null {
	if (isLeaf(root)) return root.id === id ? root : null;
	for (const child of root.children) {
		const hit = findLeafById(child, id);
		if (hit) return hit;
	}
	return null;
}

export function findPathToLeaf(
	root: PaneNode,
	leafId: string,
): PaneNode[] | null {
	if (isLeaf(root)) return root.id === leafId ? [root] : null;
	for (const child of root.children) {
		const sub = findPathToLeaf(child, leafId);
		if (sub) return [root, ...sub];
	}
	return null;
}

/**
 * Locate the innermost split that contains `leafId` and matches
 * `direction`. Returns the split, the index of the descendant branch that
 * carries the leaf, and the leaf itself. Used by the keyboard nudges to
 * decide which boundary to move.
 */
export function findInnermostSplit(
	root: PaneNode,
	leafId: string,
	direction: SplitDirection,
): { split: PaneSplit; branchIndex: number } | null {
	const path = findPathToLeaf(root, leafId);
	if (!path) return null;
	for (let i = path.length - 2; i >= 0; i--) {
		const node = path[i];
		const child = path[i + 1];
		if (!node || !child) continue;
		if (isSplit(node) && node.direction === direction) {
			const branchIndex = node.children.findIndex((c) => c.id === child.id);
			if (branchIndex >= 0) return { split: node, branchIndex };
		}
	}
	return null;
}

/**
 * Move `delta` percentage from a donor sibling into `branchIndex`. Prefers
 * the right/lower neighbour as the donor, falls back to the left/upper.
 * Clamps so neither participant drops below `minPct`.
 */
export function redistributeSizes(
	sizes: number[],
	branchIndex: number,
	delta: number,
	minPct: number,
): number[] {
	if (sizes.length < 2) return sizes;
	const next = [...sizes];
	const donor =
		branchIndex + 1 < next.length ? branchIndex + 1 : branchIndex - 1;
	if (donor < 0 || branchIndex < 0 || branchIndex >= next.length) return next;
	const target = next[branchIndex] ?? 0;
	const donorSize = next[donor] ?? 0;
	// give positive => target grows, donor shrinks; clamp both endpoints
	// against minPct.
	let give = delta;
	if (give > donorSize - minPct) give = donorSize - minPct;
	if (target + give < minPct) give = minPct - target;
	if (donorSize - give < minPct) give = donorSize - minPct;
	if (give === 0 || Number.isNaN(give)) return next;
	next[branchIndex] = target + give;
	next[donor] = donorSize - give;
	return next;
}

export function findParentSplit(
	root: PaneNode,
	childId: string,
): PaneSplit | null {
	if (isLeaf(root)) return null;
	for (const child of root.children) {
		if (child.id === childId) return root;
		const hit = findParentSplit(child, childId);
		if (hit) return hit;
	}
	return null;
}

export function collectOpenViewKinds(root: PaneNode): ViewKind[] {
	const out: ViewKind[] = [];
	function walk(node: PaneNode) {
		if (isLeaf(node)) {
			if (node.view !== "editor") out.push(node.view as ViewKind);
		} else {
			for (const c of node.children) walk(c);
		}
	}
	walk(root);
	return out;
}

export function isViewOpen(root: PaneNode, view: LeafView): boolean {
	return findLeafByView(root, view) !== null;
}

export function equalSizes(count: number): number[] {
	if (count <= 0) return [];
	const share = 100 / count;
	return Array.from({ length: count }, () => share);
}

/**
 * Append a new view leaf to the root horizontal split. If the view is
 * already present in the tree, returns the tree unchanged. The append also
 * resets the root split sizes so the new pane gets an equal share.
 */
export function addViewToRoot(root: PaneSplit, view: ViewKind): PaneSplit {
	if (isViewOpen(root, view)) return root;
	const newLeaf: PaneLeaf = { kind: "leaf", id: nextLeafId(view), view };
	const children = [...root.children, newLeaf];
	return { ...root, children, sizes: equalSizes(children.length) };
}

/**
 * Replace `leafId` with a vertical split containing the original leaf plus
 * a new leaf for `newView`. Used by the "Split Below" command. If the leaf
 * is not found, the tree is returned unchanged.
 */
export function splitLeafVertically(
	root: PaneSplit,
	leafId: string,
	newView: ViewKind,
): PaneSplit {
	function walk(node: PaneNode): PaneNode {
		if (isLeaf(node)) {
			if (node.id !== leafId) return node;
			const sibling: PaneLeaf = {
				kind: "leaf",
				id: nextLeafId(newView),
				view: newView,
			};
			const split: PaneSplit = {
				kind: "split",
				id: nextSplitId("vertical"),
				direction: "vertical",
				children: [node, sibling],
				sizes: [50, 50],
			};
			return split;
		}
		return { ...node, children: node.children.map(walk) };
	}
	return walk(root) as PaneSplit;
}

/**
 * Remove a leaf by id, collapsing any single-child splits that result
 * (except the root, which always stays as a horizontal split). The editor
 * leaf is never removed even if requested.
 */
export function removeLeaf(root: PaneSplit, leafId: string): PaneSplit {
	if (leafId === EDITOR_LEAF_ID) return root;

	function walk(node: PaneNode): PaneNode | null {
		if (isLeaf(node)) {
			return node.id === leafId ? null : node;
		}
		const kept = node.children
			.map(walk)
			.filter((c): c is PaneNode => c !== null);
		if (kept.length === 0) return null;
		// Collapse non-root splits that end up with a single child.
		if (kept.length === 1 && node.id !== ROOT_SPLIT_ID) {
			return kept[0] as PaneNode;
		}
		const sizesChanged = kept.length !== node.children.length;
		return {
			...node,
			children: kept,
			sizes: sizesChanged ? equalSizes(kept.length) : node.sizes,
		};
	}
	const next = walk(root);
	if (!next || isLeaf(next)) {
		// Should be impossible given the editor-guard above; reset defensively.
		return defaultPaneTree();
	}
	return next as PaneSplit;
}

export function removeViewFromTree(root: PaneSplit, view: ViewKind): PaneSplit {
	const leaf = findLeafByView(root, view);
	if (!leaf) return root;
	return removeLeaf(root, leaf.id);
}

export function removeAllViews(root: PaneSplit): PaneSplit {
	// Strip every non-editor leaf in one walk so we don't bounce through the
	// per-leaf collapse logic N times.
	function walk(node: PaneNode): PaneNode | null {
		if (isLeaf(node)) return node.view === "editor" ? node : null;
		const kept = node.children
			.map(walk)
			.filter((c): c is PaneNode => c !== null);
		if (kept.length === 0) return null;
		if (kept.length === 1 && node.id !== ROOT_SPLIT_ID) {
			return kept[0] as PaneNode;
		}
		return { ...node, children: kept, sizes: equalSizes(kept.length) };
	}
	const next = walk(root);
	if (!next || isLeaf(next)) return defaultPaneTree();
	return next as PaneSplit;
}

/**
 * Set the size ratio for a split's children. The renderer calls this on
 * every drag-stop so the persisted tree always reflects the on-screen
 * layout.
 */
export function setSplitSizes(
	root: PaneSplit,
	splitId: string,
	sizes: number[],
): PaneSplit {
	function walk(node: PaneNode): PaneNode {
		if (isLeaf(node)) return node;
		if (node.id === splitId) {
			if (sizes.length !== node.children.length) return node;
			return { ...node, sizes };
		}
		return { ...node, children: node.children.map(walk) };
	}
	return walk(root) as PaneSplit;
}

/**
 * Sanity-check a serialised tree coming out of localStorage. If anything
 * looks off (missing editor, malformed split, etc.) fall back to defaults.
 * This keeps a bad migration from soft-bricking the shell.
 */
export function validateTree(candidate: unknown): PaneSplit {
	if (!isPaneSplit(candidate)) return defaultPaneTree();
	if (candidate.direction !== "horizontal") return defaultPaneTree();
	if (candidate.id !== ROOT_SPLIT_ID) return defaultPaneTree();
	if (!hasEditor(candidate)) return defaultPaneTree();
	return candidate;
}

function isPaneNode(value: unknown): value is PaneNode {
	if (!value || typeof value !== "object") return false;
	const v = value as { kind?: unknown };
	return v.kind === "leaf" || v.kind === "split";
}

function isPaneSplit(value: unknown): value is PaneSplit {
	if (!isPaneNode(value) || value.kind !== "split") return false;
	if (!Array.isArray(value.children) || value.children.length === 0) {
		return false;
	}
	return value.children.every(isPaneNode);
}

function hasEditor(node: PaneNode): boolean {
	if (isLeaf(node)) return node.view === "editor";
	return node.children.some(hasEditor);
}
