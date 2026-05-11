import { Button } from "@gnosis/ui/components/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@gnosis/ui/components/combobox";
import { Input } from "@gnosis/ui/components/input";
import { Slider } from "@gnosis/ui/components/slider";
import { Switch } from "@gnosis/ui/components/switch";
import { cn } from "@gnosis/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Reusable Settings dialog primitives. Each pane composes these instead of
 * inlining `<div className="flex…">` so spacing, label-typography, and
 * description placement stay consistent across panes.
 *
 * The intent is *control*-level reuse, not full setting wiring — every
 * caller still owns its own value / setter pair so the store stays the one
 * source of truth.
 */

interface SettingRowProps {
	label: string;
	description?: ReactNode;
	control: ReactNode;
	/** Render the control under the description instead of to the right.
	 * Useful for wide controls like CSV text inputs or sliders + numeric
	 * inputs that don't fit the right rail. */
	stacked?: boolean;
}

export function SettingRow({
	label,
	description,
	control,
	stacked,
}: SettingRowProps): ReactNode {
	if (stacked) {
		return (
			<div className="flex flex-col gap-2 border-border/40 border-b py-4 last:border-b-0">
				<div className="flex flex-col gap-1">
					<span className="font-medium text-foreground text-sm">{label}</span>
					{description ? (
						<span className="text-muted-foreground text-xs">{description}</span>
					) : null}
				</div>
				<div>{control}</div>
			</div>
		);
	}
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

export function PaneHeading({ children }: { children: ReactNode }): ReactNode {
	return (
		<h2 className="mb-4 font-semibold text-foreground text-lg tracking-tight">
			{children}
		</h2>
	);
}

export function PaneFooter({ children }: { children: ReactNode }): ReactNode {
	return (
		<div className="mt-6 flex items-center justify-end border-border/40 border-t pt-4">
			{children}
		</div>
	);
}

interface NumberFieldProps {
	value: number;
	min: number;
	max: number;
	step?: number;
	unit?: string;
	onChange(next: number): void;
}

/** Slider + numeric readout. Step defaults to 1; pass a fractional step for
 *  unitless floats like line-height. */
export function SliderField({
	value,
	min,
	max,
	step = 1,
	unit = "",
	onChange,
}: NumberFieldProps): ReactNode {
	return (
		<div className="flex w-56 items-center gap-3">
			<Slider
				value={[value]}
				min={min}
				max={max}
				step={step}
				onValueChange={(values) => {
					const next = Array.isArray(values) ? values[0] : values;
					if (typeof next === "number") onChange(next);
				}}
			/>
			<span className="w-14 text-right font-mono text-muted-foreground text-xs tabular-nums">
				{formatNumber(value, step)}
				{unit}
			</span>
		</div>
	);
}

function formatNumber(value: number, step: number): string {
	if (step >= 1) return `${Math.round(value)}`;
	const digits = step < 0.1 ? 2 : 1;
	return value.toFixed(digits);
}

export function NumberInputField({
	value,
	min,
	max,
	step = 1,
	unit = "",
	onChange,
}: NumberFieldProps): ReactNode {
	return (
		<div className="flex items-center gap-2">
			<Input
				type="number"
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={(e) => {
					const next = Number(e.currentTarget.value);
					if (!Number.isNaN(next)) onChange(next);
				}}
				className="!w-20 text-right tabular-nums"
			/>
			{unit ? (
				<span className="font-mono text-muted-foreground text-xs">{unit}</span>
			) : null}
		</div>
	);
}

interface SwitchFieldProps {
	checked: boolean;
	onCheckedChange(next: boolean): void;
}

export function SwitchField({
	checked,
	onCheckedChange,
}: SwitchFieldProps): ReactNode {
	return <Switch checked={checked} onCheckedChange={onCheckedChange} />;
}

interface SelectFieldProps<T extends string> {
	value: T;
	options: readonly { value: T; label: string }[];
	onChange(next: T): void;
	widthClass?: string;
}

export function SelectField<T extends string>({
	value,
	options,
	onChange,
	widthClass = "w-44",
}: SelectFieldProps<T>): ReactNode {
	const selected = options.find((o) => o.value === value);
	return (
		<Combobox
			items={options as unknown as { value: string; label: string }[]}
			itemToStringLabel={(item) =>
				(item as { value: string; label: string }).label
			}
			itemToStringValue={(item) =>
				(item as { value: string; label: string }).value
			}
			value={selected as unknown as { value: string; label: string } | null}
			onValueChange={(next) => {
				const v = (next as { value: string } | null)?.value;
				if (typeof v === "string") onChange(v as T);
			}}
		>
			<ComboboxInput
				showTrigger
				readOnly
				className={cn(widthClass)}
				aria-label="Select an option"
			/>
			<ComboboxContent>
				<ComboboxList>
					{options.map((opt) => (
						<ComboboxItem key={opt.value} value={opt}>
							{opt.label}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

interface TextFieldProps {
	value: string;
	onChange(next: string): void;
	placeholder?: string;
	widthClass?: string;
	monospace?: boolean;
}

export function TextField({
	value,
	onChange,
	placeholder,
	widthClass = "w-56",
	monospace,
}: TextFieldProps): ReactNode {
	return (
		<Input
			type="text"
			value={value}
			placeholder={placeholder}
			onChange={(e) => onChange(e.currentTarget.value)}
			className={cn(widthClass, monospace && "font-mono")}
		/>
	);
}

interface ColorFieldProps {
	value: string;
	onChange(next: string): void;
}

export function ColorField({ value, onChange }: ColorFieldProps): ReactNode {
	return (
		<div className="flex items-center gap-2">
			<input
				type="color"
				value={value}
				onChange={(e) => onChange(e.currentTarget.value)}
				className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0"
				aria-label="Pick color"
			/>
			<Input
				type="text"
				value={value}
				onChange={(e) => onChange(e.currentTarget.value)}
				className="!w-24 font-mono text-xs uppercase"
			/>
		</div>
	);
}

interface ResetLinkProps {
	onClick(): void;
	label?: string;
}

export function ResetLink({
	onClick,
	label = "Restore section defaults",
}: ResetLinkProps): ReactNode {
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={onClick}
			className="text-muted-foreground text-xs hover:text-foreground"
		>
			{label}
		</Button>
	);
}

interface KbdProps {
	children: ReactNode;
}

export function Kbd({ children }: KbdProps): ReactNode {
	return (
		<kbd className="inline-flex h-5 items-center rounded border border-border bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
			{children}
		</kbd>
	);
}

interface ReadonlyRowProps {
	label: string;
	value: ReactNode;
}

export function ReadonlyRow({ label, value }: ReadonlyRowProps): ReactNode {
	return (
		<div className="flex items-center justify-between gap-6 border-border/40 border-b py-3 last:border-b-0">
			<span className="font-mono text-muted-foreground text-xs">{label}</span>
			<span className="text-foreground text-xs">{value}</span>
		</div>
	);
}
