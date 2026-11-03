/**
 * Options a plugin's or an extension's drawing offers (13 §12.6): on-or-off
 * choices it declares, such as the animated thermostat's "Pulse while it
 * works". The look editor shows them under the chosen drawing, the look keeps
 * what was chosen (`Look.options`), and the drawing is given them: a Rive file
 * as view model values by the same names, code as its `options`.
 */
import { extensions, type DrawingOption } from './extensions.svelte.js';
import type { Look } from './looks/model.js';
import { pluginUis } from './pluginUi/uis.svelte.js';

const NAME = /^[a-z][a-zA-Z0-9_]{0,31}$/;

/** What a drawing offers, by its id in a look. Built-in and made drawings offer none. */
export function offeredOptions(id: string): DrawingOption[] {
	if (id.startsWith('ext:')) return extensions.find(id)?.element.options ?? [];
	if (id.startsWith('plugin:'))
		return (pluginUis.look(id)?.slot.options ?? [])
			.filter((o) => NAME.test(o.id) && o.type === 'boolean' && !!o.label?.trim())
			.slice(0, 8)
			.map((o) => ({ id: o.id, label: o.label, type: 'boolean', default: o.default !== false }));
	return [];
}

/** Each offered option as the look has it, else the drawing's default. */
export function optionValues(look: Look, id: string): Record<string, boolean> {
	return Object.fromEntries(
		offeredOptions(id).map((o) => [o.id, look.options?.[id]?.[o.id] ?? o.default])
	);
}

/** The look with one option of a drawing set. */
export function withOption(look: Look, id: string, option: string, on: boolean): Look {
	return { ...look, options: { ...look.options, [id]: { ...look.options?.[id], [option]: on } } };
}
