/**
 * A wall keypad's buttons, as plain data: their numbers and the names the
 * drawing shows. A button's name is the one the keypad's plugin reports in
 * `button_names` (the household's label, else the engraving), else the one
 * homeCore keeps for it, else the engraving, else "Button 3".
 */
import type { CoreDevice } from '../devices.js';

export interface KeypadButton {
	n: number;
	/** What the drawing shows on it. */
	name: string;
	/** What is engraved on it, when the keypad says. */
	engraved?: string;
}

/** A name the keypad gave a button for want of one: "Button 3". */
export const blankName = (s: string): boolean => /^button \d+$/i.test(s.trim());

const named = (v: unknown): string | undefined =>
	typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

/** The plugin's names for the keypad's buttons, by number. */
function reported(d: CoreDevice): Record<string, string> {
	const raw = d.attributes?.button_names;
	return raw && typeof raw === 'object' && !Array.isArray(raw)
		? (raw as Record<string, string>)
		: {};
}

/** What a button shows: the first real name, else whatever placeholder there is. */
export function buttonName(d: CoreDevice, n: number, engraved?: string): string {
	const said = [named(reported(d)[String(n)]), named(d.button_names?.[String(n)]), named(engraved)];
	return (
		said.find((s) => s !== undefined && !blankName(s)) ?? said.find((s) => !!s) ?? `Button ${n}`
	);
}

/** The keypad's buttons, in its own order. */
export function keypadButtons(d: CoreDevice): KeypadButton[] {
	const raw = Array.isArray(d.attributes?.available_buttons)
		? (d.attributes.available_buttons as unknown[])
		: [];
	return raw
		.map((b) => {
			const n =
				typeof b === 'number'
					? b
					: typeof (b as { number?: unknown })?.number === 'number'
						? (b as { number: number }).number
						: NaN;
			const engraved = named((b as { name?: unknown })?.name);
			return { n, name: buttonName(d, n, engraved), engraved };
		})
		.filter((b) => Number.isFinite(b.n));
}

/** Whether the keypad's plugin lets its buttons be renamed. */
export const renames = (d: CoreDevice): boolean =>
	!!d.schema?.actions?.some((a) => a.id === 'set_button_name');
