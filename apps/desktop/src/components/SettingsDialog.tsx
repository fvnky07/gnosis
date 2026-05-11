import { Button } from "@gnosis/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@gnosis/ui/components/dialog";
import { ScrollArea } from "@gnosis/ui/components/scroll-area";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@gnosis/ui/components/tabs";
import { cn } from "@gnosis/ui/lib/utils";
import {
	FileText,
	Info,
	Keyboard,
	Layout,
	type LucideIcon,
	MonitorSmartphone,
	Palette,
	PenLine,
	Settings as SettingsIcon,
	Terminal,
	Wrench,
} from "lucide-react";
import { type ReactNode, useRef } from "react";
import { type SettingsSection, useSettings } from "../lib/settings-store";
import {
	ColorField,
	Kbd,
	NumberInputField,
	PaneFooter,
	PaneHeading,
	ReadonlyRow,
	ResetLink,
	SelectField,
	SettingRow,
	SliderField,
	SwitchField,
	TextField,
} from "./SettingsControls";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange(next: boolean): void;
	vaultPath?: string;
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
			{ value: "appearance", label: "Appearance", icon: Palette },
			{ value: "layout", label: "Layout", icon: Layout },
			{ value: "interface", label: "Interface", icon: MonitorSmartphone },
			{ value: "editor", label: "Editor", icon: PenLine },
			{ value: "vim", label: "Vim", icon: Terminal },
			{ value: "files", label: "Files and vault", icon: FileText },
			{ value: "hotkeys", label: "Hotkeys", icon: Keyboard },
		],
	},
	{
		heading: "Advanced",
		items: [{ value: "advanced", label: "Advanced", icon: Wrench }],
	},
	{
		heading: "About",
		items: [{ value: "about", label: "About gnosis", icon: Info }],
	},
];

export function SettingsDialog({
	open,
	onOpenChange,
	vaultPath,
}: SettingsDialogProps): ReactNode {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton
				className={cn(
					"data-[state=open]:slide-in-from-top-2",
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
							<GeneralPane vaultPath={vaultPath} />
						</TabsContent>
						<TabsContent
							value="appearance"
							className="m-0 px-8 py-6 outline-none"
						>
							<AppearancePane />
						</TabsContent>
						<TabsContent value="layout" className="m-0 px-8 py-6 outline-none">
							<LayoutPane />
						</TabsContent>
						<TabsContent
							value="interface"
							className="m-0 px-8 py-6 outline-none"
						>
							<InterfacePane />
						</TabsContent>
						<TabsContent value="editor" className="m-0 px-8 py-6 outline-none">
							<EditorSettingsPane />
						</TabsContent>
						<TabsContent value="vim" className="m-0 px-8 py-6 outline-none">
							<VimPane />
						</TabsContent>
						<TabsContent value="files" className="m-0 px-8 py-6 outline-none">
							<FilesPane vaultPath={vaultPath} />
						</TabsContent>
						<TabsContent value="hotkeys" className="m-0 px-8 py-6 outline-none">
							<HotkeysPane />
						</TabsContent>
						<TabsContent
							value="advanced"
							className="m-0 px-8 py-6 outline-none"
						>
							<AdvancedPane />
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

function SectionResetLink({
	section,
}: {
	section: SettingsSection;
}): ReactNode {
	const resetSection = useSettings((s) => s.resetSection);
	return (
		<PaneFooter>
			<ResetLink onClick={() => resetSection(section)} />
		</PaneFooter>
	);
}

// ── General ────────────────────────────────────────────────────────────────

function GeneralPane({ vaultPath }: { vaultPath?: string }): ReactNode {
	const resetAll = useSettings((s) => s.resetAll);
	const exportJson = useSettings((s) => s.exportJson);
	const importJson = useSettings((s) => s.importJson);
	const fileRef = useRef<HTMLInputElement | null>(null);

	const handleExport = () => {
		const payload = exportJson();
		const blob = new Blob([payload], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "gnosis-settings.json";
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleImport = () => fileRef.current?.click();

	const onFile = (file: File | null) => {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const text = typeof reader.result === "string" ? reader.result : "";
			const result = importJson(text);
			if (!result.ok) {
				console.warn("import failed:", result.error);
			}
		};
		reader.readAsText(file);
	};

	return (
		<>
			<PaneHeading>General</PaneHeading>
			<ReadonlyRow
				label="Vault path"
				value={vaultPath ?? <span className="text-muted-foreground">—</span>}
			/>
			<SettingRow
				label="Export settings"
				description="Download a JSON file of every persisted preference."
				control={
					<Button variant="outline" size="sm" onClick={handleExport}>
						Export…
					</Button>
				}
			/>
			<SettingRow
				label="Import settings"
				description="Replace current preferences with a previously exported JSON file."
				control={
					<>
						<Button variant="outline" size="sm" onClick={handleImport}>
							Import…
						</Button>
						<input
							ref={fileRef}
							type="file"
							accept="application/json"
							className="hidden"
							onChange={(e) => onFile(e.currentTarget.files?.[0] ?? null)}
						/>
					</>
				}
			/>
			<SettingRow
				label="Reset all settings"
				description="Restore every section to its built-in default. Cannot be undone."
				control={
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							if (
								typeof window === "undefined" ||
								window.confirm("Reset every gnosis setting to its default?")
							) {
								resetAll();
							}
						}}
					>
						Reset all
					</Button>
				}
			/>
		</>
	);
}

// ── Appearance ─────────────────────────────────────────────────────────────

function AppearancePane(): ReactNode {
	const a = useSettings((s) => s.appearance);
	const update = useSettings((s) => s.updateAppearance);
	return (
		<>
			<PaneHeading>Appearance</PaneHeading>
			<SettingRow
				label="Theme"
				description="Follow OS appearance or force a fixed theme."
				control={
					<SelectField
						value={a.themeMode}
						options={[
							{ value: "system", label: "Follow system" },
							{ value: "light", label: "Light" },
							{ value: "dark", label: "Dark" },
						]}
						onChange={(themeMode) => update({ themeMode })}
					/>
				}
			/>
			<SettingRow
				label="Accent color"
				description="Drives focus rings and active highlights."
				control={
					<ColorField
						value={a.accentColor}
						onChange={(accentColor) => update({ accentColor })}
					/>
				}
			/>
			<SettingRow
				label="Density"
				description="Compact tightens spacing; spacious adds breathing room."
				control={
					<SelectField
						value={a.density}
						options={[
							{ value: "compact", label: "Compact" },
							{ value: "comfortable", label: "Comfortable" },
							{ value: "spacious", label: "Spacious" },
						]}
						onChange={(density) => update({ density })}
					/>
				}
			/>
			<SettingRow
				label="UI font scale"
				description={
					"Scales every chrome surface (sidebars, palette, dialogs). Editor body is scaled separately."
				}
				control={
					<SliderField
						value={a.uiFontScale}
						min={0.85}
						max={1.25}
						step={0.05}
						unit="×"
						onChange={(uiFontScale) => update({ uiFontScale })}
					/>
				}
			/>
			<SettingRow
				label="Corner radius"
				description="Sharpness of dialogs, cards, and buttons."
				control={
					<SliderField
						value={a.radiusPx}
						min={0}
						max={24}
						unit="px"
						onChange={(radiusPx) => update({ radiusPx })}
					/>
				}
			/>
			<SettingRow
				label="Window opacity"
				description="Lower values let the desktop wallpaper bleed through (translucent shell)."
				control={
					<SliderField
						value={a.windowOpacity}
						min={0.8}
						max={1.0}
						step={0.01}
						onChange={(windowOpacity) => update({ windowOpacity })}
					/>
				}
			/>
			<SettingRow
				label="Card border"
				description="Outline around the editor card."
				control={
					<SwitchField
						checked={a.cardBorderVisible}
						onCheckedChange={(cardBorderVisible) =>
							update({ cardBorderVisible })
						}
					/>
				}
			/>
			<SettingRow
				label="Enable animations"
				description="Pane transitions, palette slide-in, mode-pill swap."
				control={
					<SwitchField
						checked={a.motionEnabled}
						onCheckedChange={(motionEnabled) => update({ motionEnabled })}
					/>
				}
			/>
			<SettingRow
				label="Respect OS reduced-motion"
				description="When the system asks for less motion, override the toggle above."
				control={
					<SwitchField
						checked={a.respectReducedMotion}
						onCheckedChange={(respectReducedMotion) =>
							update({ respectReducedMotion })
						}
					/>
				}
			/>
			<SectionResetLink section="appearance" />
		</>
	);
}

// ── Layout ─────────────────────────────────────────────────────────────────

function LayoutPane(): ReactNode {
	const l = useSettings((s) => s.layout);
	const update = useSettings((s) => s.updateLayout);
	return (
		<>
			<PaneHeading>Layout</PaneHeading>
			<SettingRow
				label="Outer gap"
				description="Padding between the window edge and the editor card."
				control={
					<SliderField
						value={l.outerGapPx}
						min={0}
						max={48}
						unit="px"
						onChange={(outerGapPx) => update({ outerGapPx })}
					/>
				}
			/>
			<SettingRow
				label="Inner gap"
				description="Gap between the editor card and the open view pane."
				control={
					<SliderField
						value={l.innerGapPx}
						min={0}
						max={48}
						unit="px"
						onChange={(innerGapPx) => update({ innerGapPx })}
					/>
				}
			/>
			<SettingRow
				label="Page max width"
				description="Hard cap on the editor card's horizontal span."
				control={
					<SliderField
						value={l.pageMaxWidthPx}
						min={600}
						max={1600}
						unit="px"
						onChange={(pageMaxWidthPx) => update({ pageMaxWidthPx })}
					/>
				}
			/>
			<SettingRow
				label="Readable line length"
				description="Note column width as a percentage of the card."
				control={
					<SliderField
						value={l.noteWidthPct}
						min={30}
						max={100}
						unit="%"
						onChange={(noteWidthPct) => update({ noteWidthPct })}
					/>
				}
			/>
			<SettingRow
				label="Center content"
				description="Horizontally center the editor column inside the card."
				control={
					<SwitchField
						checked={l.centerContent}
						onCheckedChange={(centerContent) => update({ centerContent })}
					/>
				}
			/>
			<SettingRow
				label="Editor horizontal padding"
				description="Space between the text column and the card's left/right edges."
				control={
					<SliderField
						value={l.editorPaddingX}
						min={0}
						max={96}
						unit="px"
						onChange={(editorPaddingX) => update({ editorPaddingX })}
					/>
				}
			/>
			<SettingRow
				label="Editor vertical padding"
				description="Space above and below the text column."
				control={
					<SliderField
						value={l.editorPaddingY}
						min={0}
						max={96}
						unit="px"
						onChange={(editorPaddingY) => update({ editorPaddingY })}
					/>
				}
			/>
			<SettingRow
				label="View pane width"
				description="Width of the journal/agenda/todos panel."
				control={
					<SliderField
						value={l.viewSidebarWidthPx}
						min={320}
						max={640}
						unit="px"
						onChange={(viewSidebarWidthPx) => update({ viewSidebarWidthPx })}
					/>
				}
			/>
			<SettingRow
				label="View pane side"
				description="Which side the view pane docks on."
				control={
					<SelectField
						value={l.viewSidebarPosition}
						options={[
							{ value: "right", label: "Right" },
							{ value: "left", label: "Left" },
						]}
						onChange={(viewSidebarPosition) => update({ viewSidebarPosition })}
					/>
				}
			/>
			<SectionResetLink section="layout" />
		</>
	);
}

// ── Interface ──────────────────────────────────────────────────────────────

function InterfacePane(): ReactNode {
	const sb = useSettings((s) => s.interface.statusBar);
	const tabs = useSettings((s) => s.interface.tabs);
	const palette = useSettings((s) => s.interface.palette);
	const breadcrumbsEnabled = useSettings((s) => s.interface.breadcrumbsEnabled);
	const updateStatusBar = useSettings((s) => s.updateStatusBar);
	const updateTabs = useSettings((s) => s.updateTabs);
	const updatePalette = useSettings((s) => s.updatePalette);
	const updateInterface = useSettings((s) => s.updateInterface);
	return (
		<>
			<PaneHeading>Interface</PaneHeading>

			<SubSection title="Status bar">
				<SettingRow
					label="Show status bar"
					description="Inline indicator row at the bottom of the window."
					control={
						<SwitchField
							checked={sb.visible}
							onCheckedChange={(visible) => updateStatusBar({ visible })}
						/>
					}
				/>
				<SettingRow
					label="Mode pill"
					description="Vim mode indicator (NORMAL / INSERT / VISUAL…)."
					control={
						<SwitchField
							checked={sb.showMode}
							onCheckedChange={(showMode) => updateStatusBar({ showMode })}
						/>
					}
				/>
				<SettingRow
					label="File path"
					control={
						<SwitchField
							checked={sb.showFilePath}
							onCheckedChange={(showFilePath) =>
								updateStatusBar({ showFilePath })
							}
						/>
					}
				/>
				<SettingRow
					label="Line and column"
					control={
						<SwitchField
							checked={sb.showLineCol}
							onCheckedChange={(showLineCol) =>
								updateStatusBar({ showLineCol })
							}
						/>
					}
				/>
				<SettingRow
					label="Word count"
					control={
						<SwitchField
							checked={sb.showWordCount}
							onCheckedChange={(showWordCount) =>
								updateStatusBar({ showWordCount })
							}
						/>
					}
				/>
				<SettingRow
					label="Character count"
					control={
						<SwitchField
							checked={sb.showCharCount}
							onCheckedChange={(showCharCount) =>
								updateStatusBar({ showCharCount })
							}
						/>
					}
				/>
				<SettingRow
					label="Reading time"
					description="Estimated minutes at 250 wpm."
					control={
						<SwitchField
							checked={sb.showReadingTime}
							onCheckedChange={(showReadingTime) =>
								updateStatusBar({ showReadingTime })
							}
						/>
					}
				/>
				<SettingRow
					label="Vim register"
					description="Last yank / macro register."
					control={
						<SwitchField
							checked={sb.showVimRegister}
							onCheckedChange={(showVimRegister) =>
								updateStatusBar({ showVimRegister })
							}
						/>
					}
				/>
				<SettingRow
					label="Clock"
					control={
						<SwitchField
							checked={sb.showClock}
							onCheckedChange={(showClock) => updateStatusBar({ showClock })}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Command palette">
				<SettingRow
					label="Anchor"
					description="Top floats below the title bar; center pins to the middle of the window."
					control={
						<SelectField
							value={palette.position}
							options={[
								{ value: "top", label: "Top" },
								{ value: "center", label: "Center" },
							]}
							onChange={(position) => updatePalette({ position })}
						/>
					}
				/>
				<SettingRow
					label="Top offset"
					description="Distance from the top of the window (when anchored top)."
					control={
						<SliderField
							value={palette.topOffsetVh}
							min={5}
							max={25}
							unit="vh"
							onChange={(topOffsetVh) => updatePalette({ topOffsetVh })}
						/>
					}
				/>
				<SettingRow
					label="Width"
					control={
						<SliderField
							value={palette.widthPx}
							min={480}
							max={800}
							unit="px"
							onChange={(widthPx) => updatePalette({ widthPx })}
						/>
					}
				/>
				<SettingRow
					label="Backdrop"
					description="How the palette obscures the editor behind it."
					control={
						<SelectField
							value={palette.backdrop}
							options={[
								{ value: "blur", label: "Blur" },
								{ value: "dim", label: "Dim" },
								{ value: "none", label: "None" },
							]}
							onChange={(backdrop) => updatePalette({ backdrop })}
						/>
					}
				/>
				<SettingRow
					label="Result limit"
					description="Maximum entries shown per query."
					control={
						<SliderField
							value={palette.resultLimit}
							min={10}
							max={100}
							onChange={(resultLimit) => updatePalette({ resultLimit })}
						/>
					}
				/>
				<SettingRow
					label="Preserve query on reopen"
					description="Re-opening the palette restores the last typed query."
					control={
						<SwitchField
							checked={palette.preserveQueryOnReopen}
							onCheckedChange={(preserveQueryOnReopen) =>
								updatePalette({ preserveQueryOnReopen })
							}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Tabs">
				<SettingRow
					label="Show tab strip"
					description="Persistent tab bar. The Ctrl+Tab overlay still works either way."
					control={
						<SwitchField
							checked={tabs.enabled}
							onCheckedChange={(enabled) => updateTabs({ enabled })}
						/>
					}
				/>
				<SettingRow
					label="Modified dot"
					description="Show a dot when a buffer has unsaved changes."
					control={
						<SwitchField
							checked={tabs.showModifiedDot}
							onCheckedChange={(showModifiedDot) =>
								updateTabs({ showModifiedDot })
							}
						/>
					}
				/>
				<SettingRow
					label="Middle-click closes tab"
					control={
						<SwitchField
							checked={tabs.middleClickClose}
							onCheckedChange={(middleClickClose) =>
								updateTabs({ middleClickClose })
							}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Breadcrumbs">
				<SettingRow
					label="Show breadcrumbs"
					description="Heading trail at the top of the editor. Not yet wired."
					control={
						<SwitchField
							checked={breadcrumbsEnabled}
							onCheckedChange={(breadcrumbsEnabled) =>
								updateInterface({ breadcrumbsEnabled })
							}
						/>
					}
				/>
			</SubSection>

			<SectionResetLink section="interface" />
		</>
	);
}

function SubSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}): ReactNode {
	return (
		<section className="mt-6 first:mt-0">
			<h3 className="mb-2 font-semibold text-foreground text-sm uppercase tracking-wide">
				{title}
			</h3>
			{children}
		</section>
	);
}

// ── Editor ─────────────────────────────────────────────────────────────────

function EditorSettingsPane(): ReactNode {
	const e = useSettings((s) => s.editor);
	const update = useSettings((s) => s.updateEditor);
	return (
		<>
			<PaneHeading>Editor</PaneHeading>

			<SubSection title="Typography">
				<SettingRow
					label="Font family"
					description="Monospace stack used by the editor. Comma-separated for explicit fallbacks."
					control={
						<TextField
							value={e.fontFamily}
							onChange={(fontFamily) => update({ fontFamily })}
							monospace
							widthClass="w-64"
						/>
					}
				/>
				<SettingRow
					label="Font size"
					control={
						<SliderField
							value={e.fontSize}
							min={10}
							max={24}
							unit="px"
							onChange={(fontSize) => update({ fontSize })}
						/>
					}
				/>
				<SettingRow
					label="Line height"
					control={
						<SliderField
							value={e.lineHeight}
							min={1.0}
							max={2.0}
							step={0.05}
							onChange={(lineHeight) => update({ lineHeight })}
						/>
					}
				/>
				<SettingRow
					label="Letter spacing"
					control={
						<SliderField
							value={e.letterSpacingPx}
							min={-1}
							max={2}
							step={0.1}
							unit="px"
							onChange={(letterSpacingPx) => update({ letterSpacingPx })}
						/>
					}
				/>
				<SettingRow
					label="Font ligatures"
					description="Enable OpenType `liga` / `calt` features (e.g. → from ->)."
					control={
						<SwitchField
							checked={e.fontLigatures}
							onCheckedChange={(fontLigatures) => update({ fontLigatures })}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Gutter and rulers">
				<SettingRow
					label="Line numbers"
					control={
						<SelectField
							value={e.lineNumbers}
							options={[
								{ value: "off", label: "Off" },
								{ value: "absolute", label: "Absolute" },
								{ value: "relative", label: "Relative" },
							]}
							onChange={(lineNumbers) => update({ lineNumbers })}
						/>
					}
				/>
				<SettingRow
					label="Fold gutter"
					description="Click to fold headings."
					control={
						<SwitchField
							checked={e.foldGutter}
							onCheckedChange={(foldGutter) => update({ foldGutter })}
						/>
					}
				/>
				<SettingRow
					label="Indent guides"
					description="Faint vertical lines mark indentation columns."
					control={
						<SwitchField
							checked={e.indentGuides}
							onCheckedChange={(indentGuides) => update({ indentGuides })}
						/>
					}
				/>
				<SettingRow
					label="Rulers"
					description="Comma-separated column positions, e.g. `80,100`."
					control={
						<TextField
							value={e.rulers}
							onChange={(rulers) => update({ rulers })}
							placeholder="80,100"
							widthClass="w-32"
							monospace
						/>
					}
				/>
			</SubSection>

			<SubSection title="Wrapping and indent">
				<SettingRow
					label="Word wrap"
					description="Soft-wrap text past the editor edge."
					control={
						<SwitchField
							checked={e.wordWrap}
							onCheckedChange={(wordWrap) => update({ wordWrap })}
						/>
					}
				/>
				<SettingRow
					label="Wrap column"
					description="0 means wrap at the viewport edge."
					control={
						<NumberInputField
							value={e.wrapColumn}
							min={0}
							max={200}
							unit="cols"
							onChange={(wrapColumn) => update({ wrapColumn })}
						/>
					}
				/>
				<SettingRow
					label="Tab size"
					control={
						<NumberInputField
							value={e.tabSize}
							min={1}
							max={8}
							onChange={(tabSize) => update({ tabSize })}
						/>
					}
				/>
				<SettingRow
					label="Insert spaces"
					description="Pressing Tab inserts spaces instead of a tab character."
					control={
						<SwitchField
							checked={e.insertSpaces}
							onCheckedChange={(insertSpaces) => update({ insertSpaces })}
						/>
					}
				/>
				<SettingRow
					label="Trim trailing whitespace"
					description="On save, strip whitespace at the end of every line."
					control={
						<SwitchField
							checked={e.trimTrailingWhitespace}
							onCheckedChange={(trimTrailingWhitespace) =>
								update({ trimTrailingWhitespace })
							}
						/>
					}
				/>
				<SettingRow
					label="Render whitespace"
					description="Show spaces and tabs as glyphs."
					control={
						<SelectField
							value={e.renderWhitespace}
							options={[
								{ value: "none", label: "None" },
								{ value: "boundary", label: "Boundary" },
								{ value: "selection", label: "Selection only" },
								{ value: "all", label: "All" },
							]}
							onChange={(renderWhitespace) => update({ renderWhitespace })}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Selection and matching">
				<SettingRow
					label="Highlight active line"
					control={
						<SwitchField
							checked={e.highlightActiveLine}
							onCheckedChange={(highlightActiveLine) =>
								update({ highlightActiveLine })
							}
						/>
					}
				/>
				<SettingRow
					label="Match brackets"
					description="Highlight the matching `()`, `[]`, `{}`."
					control={
						<SwitchField
							checked={e.matchBrackets}
							onCheckedChange={(matchBrackets) => update({ matchBrackets })}
						/>
					}
				/>
				<SettingRow
					label="Auto-close brackets"
					description="Typing `(` inserts the matching `)`."
					control={
						<SwitchField
							checked={e.closeBrackets}
							onCheckedChange={(closeBrackets) => update({ closeBrackets })}
						/>
					}
				/>
				<SettingRow
					label="Autocomplete"
					control={
						<SwitchField
							checked={e.autocomplete}
							onCheckedChange={(autocomplete) => update({ autocomplete })}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Cursor">
				<SettingRow
					label="Cursor style"
					control={
						<SelectField
							value={e.cursorStyle}
							options={[
								{ value: "line", label: "Line" },
								{ value: "block", label: "Block" },
								{ value: "underline", label: "Underline" },
							]}
							onChange={(cursorStyle) => update({ cursorStyle })}
						/>
					}
				/>
				<SettingRow
					label="Cursor blink"
					control={
						<SwitchField
							checked={e.cursorBlink}
							onCheckedChange={(cursorBlink) => update({ cursorBlink })}
						/>
					}
				/>
				<SettingRow
					label="Cursor width"
					control={
						<SliderField
							value={e.cursorWidthPx}
							min={1}
							max={4}
							unit="px"
							onChange={(cursorWidthPx) => update({ cursorWidthPx })}
						/>
					}
				/>
				<SettingRow
					label="Scrolloff"
					description="Minimum lines kept visible above and below the cursor."
					control={
						<SliderField
							value={e.scrolloff}
							min={0}
							max={20}
							onChange={(scrolloff) => update({ scrolloff })}
						/>
					}
				/>
			</SubSection>

			<SectionResetLink section="editor" />
		</>
	);
}

// ── Vim ────────────────────────────────────────────────────────────────────

function VimPane(): ReactNode {
	const v = useSettings((s) => s.vim);
	const update = useSettings((s) => s.updateVim);
	return (
		<>
			<PaneHeading>Vim</PaneHeading>
			<SettingRow
				label="Enable vim keybindings"
				description="Modal editing across editor, palette, and views."
				control={
					<SwitchField
						checked={v.enabled}
						onCheckedChange={(enabled) => update({ enabled })}
					/>
				}
			/>
			<SettingRow
				label="Leader key"
				description="Prefix for global vim shortcuts. Typically `space`."
				control={
					<TextField
						value={v.leader}
						onChange={(leader) => update({ leader })}
						widthClass="w-32"
						monospace
					/>
				}
			/>
			<SettingRow
				label="jk-escape"
				description="In insert mode, typing `jk` quickly exits to normal."
				control={
					<SwitchField
						checked={v.jkEscape}
						onCheckedChange={(jkEscape) => update({ jkEscape })}
					/>
				}
			/>
			<SettingRow
				label="jk timeout"
				description="Window (ms) during which `jk` counts as an escape."
				control={
					<SliderField
						value={v.jkTimeoutMs}
						min={50}
						max={500}
						unit="ms"
						onChange={(jkTimeoutMs) => update({ jkTimeoutMs })}
					/>
				}
			/>
			<SettingRow
				label="Relative line numbers"
				description="Numbers count distance from the cursor in normal mode."
				control={
					<SwitchField
						checked={v.relativeNumbers}
						onCheckedChange={(relativeNumbers) => update({ relativeNumbers })}
					/>
				}
			/>
			<SettingRow
				label="Smart case search"
				description="Case-insensitive unless the query has an upper-case letter."
				control={
					<SwitchField
						checked={v.smartCase}
						onCheckedChange={(smartCase) => update({ smartCase })}
					/>
				}
			/>
			<SettingRow
				label="System clipboard yank"
				description="Yank and paste use the OS clipboard by default."
				control={
					<SwitchField
						checked={v.systemClipboard}
						onCheckedChange={(systemClipboard) => update({ systemClipboard })}
					/>
				}
			/>
			<SettingRow
				label="Start in normal mode"
				description="Newly opened buffers begin in normal instead of insert."
				control={
					<SwitchField
						checked={v.startInNormal}
						onCheckedChange={(startInNormal) => update({ startInNormal })}
					/>
				}
			/>
			<SectionResetLink section="vim" />
		</>
	);
}

// ── Files ──────────────────────────────────────────────────────────────────

function FilesPane({ vaultPath }: { vaultPath?: string }): ReactNode {
	const f = useSettings((s) => s.files);
	const o = useSettings((s) => s.org);
	const update = useSettings((s) => s.updateFiles);
	const updateOrg = useSettings((s) => s.updateOrg);
	return (
		<>
			<PaneHeading>Files and vault</PaneHeading>

			<SubSection title="Vault">
				<ReadonlyRow
					label="Vault root"
					value={
						<span className="font-mono text-[11px]">{vaultPath ?? "—"}</span>
					}
				/>
				<p className="mt-2 text-muted-foreground text-xs">
					Changing the vault root reloads the app. Use the palette command “Open
					vault…” for now; in-dialog re-pick lands in a follow-up.
				</p>
			</SubSection>

			<SubSection title="Autosave">
				<SettingRow
					label="Autosave mode"
					control={
						<SelectField
							value={f.autoSave}
							options={[
								{ value: "off", label: "Off" },
								{ value: "afterDelay", label: "After delay" },
								{ value: "onBlur", label: "On focus loss" },
							]}
							onChange={(autoSave) => update({ autoSave })}
						/>
					}
				/>
				<SettingRow
					label="Autosave delay"
					description="Idle time before flushing edits to disk."
					control={
						<SliderField
							value={f.autoSaveDelayMs}
							min={250}
							max={5000}
							step={50}
							unit="ms"
							onChange={(autoSaveDelayMs) => update({ autoSaveDelayMs })}
						/>
					}
				/>
				<SettingRow
					label="Confirm before delete"
					control={
						<SwitchField
							checked={f.confirmDelete}
							onCheckedChange={(confirmDelete) => update({ confirmDelete })}
						/>
					}
				/>
			</SubSection>

			<SubSection title="Capture targets">
				<SettingRow
					label="Default extension"
					control={
						<SelectField
							value={f.defaultExtension}
							options={[
								{ value: "org", label: ".org" },
								{ value: "md", label: ".md" },
							]}
							onChange={(defaultExtension) => update({ defaultExtension })}
						/>
					}
				/>
				<SettingRow
					label="Journal folder"
					control={
						<TextField
							value={f.journalFolder}
							onChange={(journalFolder) => update({ journalFolder })}
							monospace
						/>
					}
				/>
				<SettingRow
					label="Journal date format"
					description="Used when generating daily journal filenames."
					control={
						<TextField
							value={f.journalDateFormat}
							onChange={(journalDateFormat) => update({ journalDateFormat })}
							monospace
							widthClass="w-40"
						/>
					}
				/>
				<SettingRow
					label="Attachment folder"
					control={
						<TextField
							value={f.attachmentFolder}
							onChange={(attachmentFolder) => update({ attachmentFolder })}
							monospace
						/>
					}
				/>
			</SubSection>

			<SubSection title="Org-mode">
				<SettingRow
					label="Hide leading stars"
					description="Render headings without the `*` glyphs."
					control={
						<SwitchField
							checked={o.hideStars}
							onCheckedChange={(hideStars) => updateOrg({ hideStars })}
						/>
					}
				/>
				<SettingRow
					label="Hide emphasis markers"
					description="Display *bold*, /italic/, =verbatim= without the markers."
					control={
						<SwitchField
							checked={o.hideEmphasisMarkers}
							onCheckedChange={(hideEmphasisMarkers) =>
								updateOrg({ hideEmphasisMarkers })
							}
						/>
					}
				/>
				<SettingRow
					label="Inline images"
					description="Preview `[[file:…]]` image links inside the editor."
					control={
						<SwitchField
							checked={o.inlineImages}
							onCheckedChange={(inlineImages) => updateOrg({ inlineImages })}
						/>
					}
				/>
				<SettingRow
					label="Startup folding"
					description="How buffers open: fully expanded, body folded, or only headings."
					control={
						<SelectField
							value={o.startupFolded}
							options={[
								{ value: "showall", label: "Show all" },
								{ value: "content", label: "Content (level 1+ bodies)" },
								{ value: "overview", label: "Overview (top headings)" },
							]}
							onChange={(startupFolded) => updateOrg({ startupFolded })}
						/>
					}
				/>
				<SettingRow
					label="TODO keywords"
					description="Comma-separated states. First in each list is the open state."
					control={
						<TextField
							value={o.todoKeywords}
							onChange={(todoKeywords) => updateOrg({ todoKeywords })}
							monospace
							widthClass="w-72"
						/>
					}
				/>
			</SubSection>

			<SectionResetLink section="files" />
		</>
	);
}

// ── Hotkeys (read-only viewer) ─────────────────────────────────────────────

interface HotkeyEntry {
	keys: string[];
	command: string;
	description: string;
}

const HOTKEYS: { category: string; entries: HotkeyEntry[] }[] = [
	{
		category: "Global",
		entries: [
			{
				keys: ["⌘", "K"],
				command: "palette.open",
				description: "Open command palette",
			},
			{
				keys: ["Space", "Space"],
				command: "palette.open",
				description: "Open palette (vim normal)",
			},
			{
				keys: ["⌘", ","],
				command: "settings.open",
				description: "Open settings",
			},
			{
				keys: ["⌘", "⇧", "B"],
				command: "view.close",
				description: "Close the active view pane",
			},
			{
				keys: ["⌘", "⇧", "I"],
				command: "block.details",
				description: "Toggle block details popover",
			},
			{
				keys: ["Ctrl", "Tab"],
				command: "tabs.cycle",
				description: "Cycle open buffers (MRU)",
			},
		],
	},
	{
		category: "Leader (Space …)",
		entries: [
			{
				keys: ["Space", "f"],
				command: "palette.files",
				description: "Fuzzy-find files",
			},
			{
				keys: ["Space", "b"],
				command: "palette.blocks",
				description: "Search blocks",
			},
			{
				keys: ["Space", "o"],
				command: "palette.outline",
				description: "Jump within outline",
			},
			{
				keys: ["Space", "v"],
				command: "palette.views",
				description: "Open a view",
			},
			{
				keys: ["Space", "j"],
				command: "capture.journal",
				description: "Capture journal entry",
			},
			{
				keys: ["Space", "t"],
				command: "capture.task",
				description: "Capture task",
			},
			{
				keys: ["Space", "n"],
				command: "capture.note",
				description: "Capture note",
			},
		],
	},
	{
		category: "Vim ex commands",
		entries: [
			{
				keys: [":capture"],
				command: "capture",
				description: "Capture (kind text)",
			},
			{
				keys: [":journal", ":j"],
				command: "capture.journal",
				description: "Append to today's journal",
			},
			{
				keys: [":task", ":t"],
				command: "capture.task",
				description: "Capture a task",
			},
			{
				keys: [":done"],
				command: "block.toggleDone",
				description: "Toggle DONE on current block",
			},
			{
				keys: [":todo"],
				command: "block.toggleTodo",
				description: "Cycle TODO state",
			},
			{
				keys: [":schedule", ":sched"],
				command: "block.schedule",
				description: "Set SCHEDULED",
			},
			{
				keys: [":deadline", ":dead"],
				command: "block.deadline",
				description: "Set DEADLINE",
			},
			{
				keys: [":priority", ":prio"],
				command: "block.priority",
				description: "Set priority (A|B|C)",
			},
			{
				keys: [":tag", ":untag"],
				command: "block.tag",
				description: "Add or remove a tag",
			},
			{
				keys: [":open", ":o"],
				command: "file.open",
				description: "Open a file by path",
			},
			{
				keys: [":search", ":s"],
				command: "search.blocks",
				description: "Full-text search blocks",
			},
			{
				keys: [":view", ":v"],
				command: "view.open",
				description: "Open a view",
			},
			{
				keys: [":vault"],
				command: "vault.open",
				description: "Pick a new vault",
			},
			{
				keys: [":settings"],
				command: "settings.open",
				description: "Open settings",
			},
			{
				keys: [":reindex"],
				command: "vault.refresh",
				description: "Re-scan the vault",
			},
			{
				keys: [":q", ":wq", ":x"],
				command: "buffer.close",
				description: "Close (and save) the buffer",
			},
		],
	},
];

function HotkeysPane(): ReactNode {
	return (
		<>
			<PaneHeading>Hotkeys</PaneHeading>
			<p className="mb-6 text-muted-foreground text-xs">
				Read-only reference. Rebind capture lands in a follow-up — see issue
				<span className="ml-1 font-mono">feat(settings): rebind capture</span>.
			</p>
			{HOTKEYS.map((group) => (
				<SubSection key={group.category} title={group.category}>
					<div className="flex flex-col">
						{group.entries.map((entry) => (
							<div
								key={`${group.category}:${entry.command}:${entry.keys.join("+")}`}
								className="flex items-center justify-between gap-6 border-border/30 border-b py-2 last:border-b-0"
							>
								<div className="flex min-w-0 flex-col gap-0.5">
									<span className="text-foreground text-sm">
										{entry.description}
									</span>
									<span className="font-mono text-[10px] text-muted-foreground">
										{entry.command}
									</span>
								</div>
								<div className="flex shrink-0 items-center gap-1">
									{entry.keys.map((key) => (
										<Kbd key={`${entry.command}:${key}`}>{key}</Kbd>
									))}
								</div>
							</div>
						))}
					</div>
				</SubSection>
			))}
		</>
	);
}

// ── Advanced ───────────────────────────────────────────────────────────────

function AdvancedPane(): ReactNode {
	const a = useSettings((s) => s.advanced);
	const update = useSettings((s) => s.updateAdvanced);
	const resetAll = useSettings((s) => s.resetAll);
	return (
		<>
			<PaneHeading>Advanced</PaneHeading>
			<SettingRow
				label="Log level"
				description="Verbosity of the desktop log file."
				control={
					<SelectField
						value={a.logLevel}
						options={[
							{ value: "error", label: "Error" },
							{ value: "warn", label: "Warn" },
							{ value: "info", label: "Info" },
							{ value: "debug", label: "Debug" },
							{ value: "trace", label: "Trace" },
						]}
						onChange={(logLevel) => update({ logLevel })}
					/>
				}
			/>
			<SettingRow
				label="Developer mode"
				description="Enable debug palette commands and verbose UI affordances."
				control={
					<SwitchField
						checked={a.developerMode}
						onCheckedChange={(developerMode) => update({ developerMode })}
					/>
				}
			/>
			<SettingRow
				label="Experimental flags"
				description="JSON object of named flags. Restart required for some flags."
				stacked
				control={
					<TextField
						value={JSON.stringify(a.experimental)}
						onChange={(raw) => {
							try {
								const parsed = JSON.parse(raw);
								if (parsed && typeof parsed === "object") {
									update({
										experimental: parsed as Record<string, boolean>,
									});
								}
							} catch {
								// keep current value on parse error
							}
						}}
						monospace
						widthClass="w-full"
					/>
				}
			/>
			<SettingRow
				label="Reset every setting"
				description="Restore every section to its default value."
				control={
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							if (
								typeof window === "undefined" ||
								window.confirm("Reset every gnosis setting to its default?")
							) {
								resetAll();
							}
						}}
					>
						Reset all
					</Button>
				}
			/>
		</>
	);
}

// ── About ──────────────────────────────────────────────────────────────────

function AboutPane(): ReactNode {
	return (
		<>
			<PaneHeading>About gnosis</PaneHeading>
			<p className="text-muted-foreground text-sm">
				A local-first, file-based, org-mode-compatible note app driven by a
				command palette.
			</p>
			<div className="mt-6 flex flex-col gap-2 text-xs">
				<ReadonlyRow label="Version" value="0.0.0 · pre-alpha" />
				<ReadonlyRow label="License" value="MIT" />
				<ReadonlyRow
					label="Source"
					value={<span className="font-mono">github.com/fvnky07/gnosis</span>}
				/>
			</div>
		</>
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
