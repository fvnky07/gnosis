import { Button } from "@gnosis/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@gnosis/ui/components/dialog";
import { ScrollArea } from "@gnosis/ui/components/scroll-area";
import { Switch } from "@gnosis/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@gnosis/ui/components/tabs";
import { cn } from "@gnosis/ui/lib/utils";
import type { ReactNode } from "react";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange(next: boolean): void;
}

export function SettingsDialog({
	open,
	onOpenChange,
}: SettingsDialogProps): ReactNode {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton
				className={cn(
					"data-[state=open]:slide-in-from-top-4",
					"top-[6vh] left-1/2 h-[640px] max-h-[calc(100vh-6rem)] w-[min(960px,calc(100vw-3rem))] max-w-none -translate-x-1/2 translate-y-0",
					"gap-0 overflow-hidden rounded-lg border-border bg-popover p-0 text-popover-foreground shadow-2xl",
				)}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>Configure gnosis preferences.</DialogDescription>
				</DialogHeader>

				<Tabs
					defaultValue="general"
					orientation="vertical"
					className="grid h-full grid-cols-[220px_1fr] gap-0"
				>
					<TabsList
						variant="line"
						className={cn(
							"flex h-full flex-col items-stretch justify-start gap-0.5",
							"rounded-none border-border border-r bg-transparent p-3",
							"overflow-y-auto",
						)}
					>
						<SidebarHeading>Options</SidebarHeading>
						<SidebarTab value="general">General</SidebarTab>
						<SidebarTab value="editor">Editor</SidebarTab>
						<SidebarTab value="files">Files and links</SidebarTab>
						<SidebarTab value="appearance">Appearance</SidebarTab>
						<SidebarTab value="hotkeys">Hotkeys</SidebarTab>

						<SidebarHeading>Vault</SidebarHeading>
						<SidebarTab value="vault">Vault folder</SidebarTab>
						<SidebarTab value="vim">Vim</SidebarTab>

						<SidebarHeading>About</SidebarHeading>
						<SidebarTab value="about">About gnosis</SidebarTab>
					</TabsList>

					<ScrollArea className="h-full">
						<TabsContent value="general" className="m-0 px-8 py-6 outline-none">
							<SettingRow
								label="Show ribbon"
								description="Display the left-side action ribbon."
								control={<Switch defaultChecked />}
							/>
							<SettingRow
								label="Status bar"
								description="Show the status bar at the bottom of the window."
								control={<Switch defaultChecked />}
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
						</TabsContent>

						<TabsContent value="editor" className="m-0 px-8 py-6 outline-none">
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
						</TabsContent>

						<TabsContent value="vim" className="m-0 px-8 py-6 outline-none">
							<SettingRow
								label="Enable vim keybindings"
								description="Modal editing across editor and chrome."
								control={<Switch defaultChecked />}
							/>
						</TabsContent>

						<TabsContent value="files" className="m-0 px-8 py-6 outline-none" />
						<TabsContent
							value="appearance"
							className="m-0 px-8 py-6 outline-none"
						/>
						<TabsContent
							value="hotkeys"
							className="m-0 px-8 py-6 outline-none"
						/>
						<TabsContent value="vault" className="m-0 px-8 py-6 outline-none" />
						<TabsContent value="about" className="m-0 px-8 py-6 outline-none" />
					</ScrollArea>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

function SidebarHeading({ children }: { children: ReactNode }): ReactNode {
	return (
		<div className="mt-3 mb-1 px-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider first:mt-0">
			{children}
		</div>
	);
}

function SidebarTab({
	value,
	children,
}: {
	value: string;
	children: ReactNode;
}): ReactNode {
	return (
		<TabsTrigger
			value={value}
			className={cn(
				"!justify-start !rounded-md !px-3 !py-1.5 !text-sm !font-normal",
				"after:hidden",
				"data-active:!bg-accent data-active:!text-accent-foreground",
				"hover:!bg-accent/50",
			)}
		>
			{children}
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
