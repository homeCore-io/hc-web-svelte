/**
 * Where a Rive drawing comes from (13 §12.4, §12.6): a UI extension, or a
 * plugin's `look.drawing` slot that names a `rive` file in its UI's folder.
 * Both are offered in the same rows of the look editor and drawn the same way.
 */
import { extensions } from '../extensions.svelte.js';
import { pluginUis, type LookSlot } from '../pluginUi/uis.svelte.js';
import { RIVE_FAMILIES, RIVE_VALUES } from './values.js';

export interface RiveSource {
	/** Its id in a look: `ext:…` or `plugin:…`. */
	id: string;
	/** Its name in the look editor, with where it comes from. */
	name: string;
	src: string;
	artboard?: string;
	stateMachine?: string;
}

/** A file inside a plugin's UI folder. */
const inside = (p: string) =>
	/\.riv$/.test(p) &&
	!p.startsWith('/') &&
	!p.includes('\\') &&
	p.split('/').every((x) => x && x !== '..');

/** Whether a plugin's slot is a Rive drawing this app can draw. */
export const isRiveSlot = (s: LookSlot): boolean =>
	typeof s.slot.rive === 'string' && inside(s.slot.rive) && (s.slot.values ?? 1) <= RIVE_VALUES;

function fromPlugin(s: LookSlot): RiveSource {
	const file = s.slot.rive!.split('/').map(encodeURIComponent).join('/');
	return {
		id: s.id,
		name: `${s.slot.label} · ${s.pluginId.replace(/^plugin\./, '')}`,
		src: `/api/v1/plugins/${encodeURIComponent(s.pluginId)}/ui/${encodeURIComponent(s.ui.build)}/${file}`,
		artboard: s.slot.artboard,
		stateMachine: s.slot.stateMachine
	};
}

/** Every Rive drawing offered for a family. */
export function riveDrawings(family: string): RiveSource[] {
	if (!RIVE_FAMILIES.includes(family)) return [];
	extensions.ensure();
	pluginUis.ensure();
	return [
		...extensions.drawing(family).flatMap((e) =>
			e.element.kind === 'rive'
				? [
						{
							id: e.id,
							name: `${e.element.label} · ${e.extension.name}`,
							src: e.src,
							artboard: e.element.artboard,
							stateMachine: e.element.stateMachine
						}
					]
				: []
		),
		...pluginUis.looks('look.drawing', family).filter(isRiveSlot).map(fromPlugin)
	];
}

/** The Rive drawing a look names for a family, while it's still offered. */
export function riveFor(id: string, family: string): RiveSource | undefined {
	if (!id.startsWith('ext:') && !id.startsWith('plugin:')) return undefined;
	return riveDrawings(family).find((d) => d.id === id);
}
