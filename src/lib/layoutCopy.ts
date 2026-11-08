/**
 * A room's layout, carried to another (14 §8, L3). Rooms hold different
 * things, so what goes is what both can have: the headings (the sections'
 * places, names, layouts, and sections someone made), the widgets and the
 * cards added from elsewhere, and where the look's stacks are. Each room's
 * own devices then take the first gaps under their headings.
 */
import { addChange, kindRef, type Change } from './layers.js';

const SECTION_OPS: Change['op'][] = [
	'place',
	'config',
	'section',
	'rename',
	'hide',
	'show',
	'remove'
];
const ADDED_OPS: Change['op'][] = [
	'place',
	'add',
	'config',
	'rename',
	'hide',
	'show',
	'form',
	'remove'
];

/** A stack a look's rule makes (`kind:stack/rule-…`): every room has its own, holding its own things. */
const ruleStack = (ref: string) => kindRef(ref)?.kind === 'stack' && ref.includes('/rule-');

/**
 * The changes of a layer that make its layout, in their order. A stack
 * someone made goes empty: what it held is that room's.
 */
export function layoutOf(changes: Change[]): Change[] {
	return changes.flatMap((c): Change[] => {
		if (c.ref.startsWith('section:')) return SECTION_OPS.includes(c.op) ? [c] : [];
		if (ruleStack(c.ref)) return c.op === 'place' || c.op === 'form' ? [c] : [];
		if (!c.ref.startsWith('kind:') && !c.ref.startsWith('card:')) return [];
		if (!ADDED_OPS.includes(c.op)) return [];
		if (c.op === 'config' && kindRef(c.ref)?.kind === 'stack') {
			const { things: _theirs, ...rest } = c.config;
			return [{ ...c, config: { ...rest, things: [] } }];
		}
		return [c];
	});
}

/**
 * A room's changes with another's layout: its own places go, so its devices
 * fill in under the headings; what the layout names is replaced by the
 * layout's; the rest (hidden devices, names, sizes) stays.
 */
export function withLayout(target: Change[], layout: Change[]): Change[] {
	const named = new Set(layout.map((c) => c.ref));
	const kept = target.filter(
		(c) => c.op !== 'place' && !(named.has(c.ref) && layoutOf([c]).length > 0)
	);
	return layout.reduce(addChange, kept);
}

/** Back to the look's layout: a layer's places gone, and nothing else. */
export const withoutPlaces = (changes: Change[]) => changes.filter((c) => c.op !== 'place');
