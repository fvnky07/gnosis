import {
	createContext,
	Fragment,
	forwardRef,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import {
	Group,
	type GroupImperativeHandle,
	type Layout,
	Panel,
	Separator,
} from "react-resizable-panels";
import {
	equalSizes,
	isLeaf,
	type PaneLeaf,
	type PaneSplit,
	type SplitDirection,
} from "../lib/pane-layout";

/**
 * Minimum panel share, in percent. With the typical desktop viewport
 * (>= 1400 px) this lands above the 280 px floor we used to enforce with
 * `min-w-[280px]`.
 */
const LEAF_MIN_PCT = 15;

interface PaneRefRegistry {
	register(id: string, ref: GroupImperativeHandle | null): void;
}

const PaneRefsCtx = createContext<PaneRefRegistry | null>(null);

export interface PaneTreeHandle {
	setSplitSizes(splitId: string, sizes: number[]): boolean;
	getSplitSizes(splitId: string): number[] | null;
}

export interface PaneTreeProps {
	tree: PaneSplit;
	renderLeaf(leaf: PaneLeaf): ReactNode;
	onLayoutChange(splitId: string, sizes: number[]): void;
}

export const PaneTree = forwardRef<PaneTreeHandle, PaneTreeProps>(
	function PaneTree({ tree, renderLeaf, onLayoutChange }, handleRef) {
		const groupRefs = useRef<Map<string, GroupImperativeHandle>>(new Map());
		const splitChildOrder = useRef<Map<string, string[]>>(new Map());

		const register = useCallback<PaneRefRegistry["register"]>((id, ref) => {
			if (ref) groupRefs.current.set(id, ref);
			else groupRefs.current.delete(id);
		}, []);

		useImperativeHandle(
			handleRef,
			() => ({
				setSplitSizes(splitId, sizes) {
					const g = groupRefs.current.get(splitId);
					const ids = splitChildOrder.current.get(splitId);
					if (!g || !ids || ids.length !== sizes.length) return false;
					const layout: Layout = {};
					for (let i = 0; i < ids.length; i++) {
						const id = ids[i];
						const size = sizes[i];
						if (id !== undefined && size !== undefined) layout[id] = size;
					}
					g.setLayout(layout);
					return true;
				},
				getSplitSizes(splitId) {
					const g = groupRefs.current.get(splitId);
					const ids = splitChildOrder.current.get(splitId);
					if (!g || !ids) return null;
					const layout = g.getLayout();
					return ids.map((id) => layout[id] ?? 0);
				},
			}),
			[],
		);

		const ctxValue = useMemo<PaneRefRegistry>(() => ({ register }), [register]);

		const registerChildOrder = useCallback(
			(splitId: string, childIds: string[]) => {
				splitChildOrder.current.set(splitId, childIds);
			},
			[],
		);

		return (
			<PaneRefsCtx.Provider value={ctxValue}>
				<SplitNode
					node={tree}
					renderLeaf={renderLeaf}
					onLayoutChange={onLayoutChange}
					registerChildOrder={registerChildOrder}
				/>
			</PaneRefsCtx.Provider>
		);
	},
);

function SplitNode({
	node,
	renderLeaf,
	onLayoutChange,
	registerChildOrder,
}: {
	node: PaneSplit;
	renderLeaf(leaf: PaneLeaf): ReactNode;
	onLayoutChange(splitId: string, sizes: number[]): void;
	registerChildOrder(splitId: string, childIds: string[]): void;
}) {
	const refs = useContext(PaneRefsCtx);
	const groupRef = useRef<GroupImperativeHandle | null>(null);

	const setRef = useCallback(
		(handle: GroupImperativeHandle | null) => {
			groupRef.current = handle;
			refs?.register(node.id, handle);
		},
		[refs, node.id],
	);

	useEffect(() => {
		const id = node.id;
		const childIds = node.children.map((c) => c.id);
		registerChildOrder(id, childIds);
		return () => {
			refs?.register(id, null);
		};
	}, [refs, node.id, node.children, registerChildOrder]);

	const initialSizes = useMemo(() => {
		if (node.sizes && node.sizes.length === node.children.length) {
			return node.sizes;
		}
		return equalSizes(node.children.length);
	}, [node.sizes, node.children.length]);

	const defaultLayout = useMemo<Layout>(() => {
		const layout: Layout = {};
		node.children.forEach((c, i) => {
			layout[c.id] = initialSizes[i] ?? 100 / node.children.length;
		});
		return layout;
	}, [node.children, initialSizes]);

	const handleLayoutChanged = useCallback(
		(layout: Layout) => {
			const sizes = node.children.map((c) => layout[c.id] ?? 0);
			onLayoutChange(node.id, sizes);
		},
		[node.id, node.children, onLayoutChange],
	);

	return (
		<Group
			groupRef={setRef}
			id={node.id}
			orientation={node.direction}
			defaultLayout={defaultLayout}
			onLayoutChanged={handleLayoutChanged}
			className="flex flex-1"
		>
			{node.children.map((child, idx) => (
				<Fragment key={child.id}>
					{idx > 0 ? <ResizeHandle direction={node.direction} /> : null}
					<Panel
						id={child.id}
						defaultSize={initialSizes[idx]}
						minSize={LEAF_MIN_PCT}
						className="flex min-h-0 min-w-0"
					>
						{isLeaf(child) ? (
							renderLeaf(child)
						) : (
							<SplitNode
								node={child}
								renderLeaf={renderLeaf}
								onLayoutChange={onLayoutChange}
								registerChildOrder={registerChildOrder}
							/>
						)}
					</Panel>
				</Fragment>
			))}
		</Group>
	);
}

function ResizeHandle({ direction }: { direction: SplitDirection }) {
	const isHorizontal = direction === "horizontal";
	return (
		<Separator
			className={
				isHorizontal
					? "group relative w-2 shrink-0 cursor-col-resize outline-none"
					: "group relative h-2 shrink-0 cursor-row-resize outline-none"
			}
			aria-label={
				isHorizontal
					? "Resize panes horizontally (double-click to reset)"
					: "Resize panes vertically (double-click to reset)"
			}
		>
			<div
				className={
					isHorizontal
						? "pointer-events-none absolute inset-y-0 left-1/2 h-full w-px -translate-x-1/2 bg-border/40 transition-colors duration-150 group-hover:bg-border group-focus-visible:bg-primary group-data-[separator-active=true]:bg-primary"
						: "pointer-events-none absolute inset-x-0 top-1/2 h-px w-full -translate-y-1/2 bg-border/40 transition-colors duration-150 group-hover:bg-border group-focus-visible:bg-primary group-data-[separator-active=true]:bg-primary"
				}
			/>
		</Separator>
	);
}
