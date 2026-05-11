import { Button } from "@gnosis/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@gnosis/ui/components/dialog";
import { ScrollArea } from "@gnosis/ui/components/scroll-area";
import { Slider } from "@gnosis/ui/components/slider";
import { Switch } from "@gnosis/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@gnosis/ui/components/tabs";
import { cn } from "@gnosis/ui/lib/utils";
import {
	FileText,
	FolderOpen,
	Info,
	Keyboard,
	type LucideIcon,
	Palette,
	PenLine,
	Settings as SettingsIcon,
	Terminal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSettings } from "../lib/settings-store";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange(next: boolean): void;
}

interface SidebarItem {
	value: string;
	label: string;
	icon: LucideIcon;
}

interface SidebarGroup {
	heading: string;
	items: SidebarItem[];
}

const SIDEBAR: SidebarGroup[] = [
	{
		heading: "Options",
		items: [
			{ value: "general", label: "General", icon: SettingsIcon },
			{ value: "editor", label: "Editor", icon: PenLine },
			{ value: "files", label: "Files and links", icon: FileText },
			{ value: "appearance", label: "Appearance", icon: Palette },
			{ value: "hotkeys", label: "Hotkeys", icon: Keyboard },
		],
	},
	{
		heading: "Vault",
		items: [
			{ value: "vault", label: "Vault folder", icon: FolderOpen },
			{ value: "vim", label: "Vim", icon: Terminal },
		],
	},
	{
		heading: "About",
		items: [{ value: "about", label: "About gnosis", icon: Info }],
	},
];

export function SettingsDialog({
	open,
	onOpenChange,
}: SettingsDialogProps): ReactNode {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton
				className={cn(
					"data-[state=open]:slide-in-from-top-2",
					// Centered on screen, wider than tall, generous breathing room.
					"top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
					"h-[640px] max-h-[calc(100vh-6rem)] w-[min(960px,calc(100vw-3rem))] max-w-none",
					"gap-0 overflow-hidden rounded-xl border-border bg-popover p-0 text-popover-foreground shadow-2xl",
				)}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>Configure gnosis preferences.</DialogDescription>
				</DialogHeader>

				<Tabs
					defaultValue="general"
					orientation="vertical"
					className="grid h-full grid-cols-[240px_1fr] gap-0"
				>
					<TabsList
						variant="line"
						className={cn(
							"flex h-full flex-col items-stretch justify-start gap-0.5",
							// macOS sidebar surface: slightly different tint than the
							// main pane so the split reads as a true sidebar instead
							// of a flat divider line.
							"rounded-none border-border border-r bg-muted/40 p-2",
							"overflow-y-auto",
						)}
					>
						{SIDEBAR.map((group, gi) => (
							<div
								key={group.heading}
								className={cn("flex flex-col gap-0.5", gi > 0 && "mt-3")}
							>
								<SidebarHeading>{group.heading}</SidebarHeading>
								{group.items.map((item) => (
									<SidebarTab
										key={item.value}
										value={item.value}
										icon={item.icon}
									>
										{item.label}
									</SidebarTab>
								))}
							</div>
						))}
					</TabsList>

					<ScrollArea className="h-full">
						<TabsContent value="general" className="m-0 px-8 py-6 outline-none">
							<GeneralPane />
						</TabsContent>

						<TabsContent value="editor" className="m-0 px-8 py-6 outline-none">
							<EditorSettingsPane />
						</TabsContent>

						<TabsContent
							value="appearance"
							className="m-0 px-8 py-6 outline-none"
						>
							<AppearancePane />
						</TabsContent>

						<TabsContent value="vim" className="m-0 px-8 py-6 outline-none">
							<VimPane />
						</TabsContent>

						<TabsContent value="files" className="m-0 px-8 py-6 outline-none">
							<PlaceholderPane title="Files and links" />
						</TabsContent>
						<TabsContent value="hotkeys" className="m-0 px-8 py-6 outline-none">
							<PlaceholderPane title="Hotkeys" />
						</TabsContent>
						<TabsContent value="vault" className="m-0 px-8 py-6 outline-none">
							<PlaceholderPane title="Vault folder" />
						</TabsContent>
						<TabsContent value="about" className="m-0 px-8 py-6 outline-none">
							<AboutPane />
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

function GeneralPane(): ReactNode {
	const statusBarVisible = useSettings((s) => s.statusBarVisible);
	const setStatusBarVisible = useSettings((s) => s.setStatusBarVisible);
	return (
		<>
			<PaneHeading>General</PaneHeading>
			<SettingRow
				label="Status bar"
				description="Show the inline status row at the bottom of the window."
				control={
					<Switch
						checked={statusBarVisible}
						onCheckedChange={setStatusBarVisible}
					/>
				}
			/>
			<SettingRow
				label="Restricted mode"
				description="Restricted mode is off. Turn on to disable community plugins."
				control={
					<Button variant="outline" size="sm">
						Turn on and reload
					</Button>
				}
			/>
		</>
	);
}

function EditorSettingsPane(): ReactNode {
	return (
		<>
			<PaneHeading>Editor</PaneHeading>
			<SettingRow
				label="Show line numbers"
				description="Display a gutter with line numbers next to the editor."
				control={<Switch defaultChecked />}
			/>
			<SettingRow
				label="Wrap long lines"
				description="Soft-wrap text past the editor edge."
				control={<Switch />}
			/>
		</>
	);
}

function AppearancePane(): ReactNode {
	const noteWidthPct = useSettings((s) => s.noteWidthPct);
	const setNoteWidthPct = useSettings((s) => s.setNoteWidthPct);
	return (
		<>
			<PaneHeading>Appearance</PaneHeading>
			<SettingRow
				label="Readable line length"
				description={`Note column width inside the editor card. Currently ${noteWidthPct}% of the card.`}
				control={
					<div className="flex w-56 items-center gap-3">
						<Slider
							value={[noteWidthPct]}
							onValueChange={(values) => {
								const next = Array.isArray(values) ? values[0] : values;
								if (typeof next === "number") setNoteWidthPct(next);
							}}
							min={30}
							max={100}
							step={1}
						/>
						<span className="w-10 text-right font-mono text-muted-foreground text-xs tabular-nums">
							{noteWidthPct}%
						</span>
					</div>
				}
			/>
		</>
	);
}

function VimPane(): ReactNode {
	const vimEnabled = useSettings((s) => s.vimEnabled);
	const setVimEnabled = useSettings((s) => s.setVimEnabled);
	return (
		<>
			<PaneHeading>Vim</PaneHeading>
			<SettingRow
				label="Enable vim keybindings"
				description="Modal editing across editor and chrome."
				control={
					<Switch checked={vimEnabled} onCheckedChange={setVimEnabled} />
				}
			/>
		</>
	);
}

function AboutPane(): ReactNode {
	return (
		<>
			<PaneHeading>About gnosis</PaneHeading>
			<p className="text-muted-foreground text-sm">
				A native-feeling org-mode editor for macOS.
			</p>
		</>
	);
}

function PlaceholderPane({ title }: { title: string }): ReactNode {
	return (
		<>
			<PaneHeading>{title}</PaneHeading>
			<p className="text-muted-foreground text-sm">Nothing here yet.</p>
		</>
	);
}

function PaneHeading({ children }: { children: ReactNode }): ReactNode {
	return (
		<h2 className="mb-4 font-semibold text-foreground text-lg tracking-tight">
			{children}
		</h2>
	);
}

function SidebarHeading({ children }: { children: ReactNode }): ReactNode {
	return (
		<div className="mb-0.5 px-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
			{children}
		</div>
	);
}

function SidebarTab({
	value,
	icon: Icon,
	children,
}: {
	value: string;
	icon: LucideIcon;
	children: ReactNode;
}): ReactNode {
	return (
		<TabsTrigger
			value={value}
			className={cn(
				"!flex !h-7 !w-full !items-center !justify-start !gap-2 !rounded-md !px-2 !py-1 !text-sm !font-normal",
				"after:hidden",
				"hover:!bg-accent/50 text-muted-foreground hover:text-foreground",
				"data-active:!bg-accent data-active:!text-foreground",
			)}
		>
			<Icon className="size-4 shrink-0 opacity-80" />
			<span className="truncate">{children}</span>
		</TabsTrigger>
	);
}

function SettingRow({
	label,
	description,
	control,
}: {
	label: string;
	description?: string;
	control: ReactNode;
}): ReactNode {
	return (
		<div className="flex items-center justify-between gap-6 border-border/40 border-b py-4 last:border-b-0">
			<div className="flex min-w-0 flex-col gap-1">
				<span className="font-medium text-foreground text-sm">{label}</span>
				{description ? (
					<span className="text-muted-foreground text-xs">{description}</span>
				) : null}
			</div>
			<div className="shrink-0">{control}</div>
		</div>
	);
}
