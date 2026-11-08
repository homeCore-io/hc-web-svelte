import { describe, expect, it } from 'vitest';
import { formFor, piecesOf, rangeOf, within } from './freePage.js';
import { apply } from './layers.js';
import type { Card, ShownSection } from './page.js';

const card = (ref: string): Card => ({ ref, kind: 'scene', id: ref, name: ref });
const section = (id: string, shown: string[], hidden: string[] = []): ShownSection => {
	const cards = [...shown, ...hidden].map(card);
	return {
		section: { id, title: id, layout: 'grid', cards },
		title: id,
		renamed: false,
		hidden: false,
		layout: 'grid',
		groups: [
			apply(
				cards,
				(c) => c.ref,
				hidden.map((ref) => ({ op: 'hide' as const, ref }))
			)
		],
		column: 'main'
	};
};
const size = () => ({ w: 2, h: 1 });

describe('a page’s sections as pieces (14 §4)', () => {
	it('lays a thing out where it is shown, not where a copy is hidden', () => {
		const sections = [section('controls', ['lamp'], ['scene:a']), section('scenes', ['scene:a'])];
		const { items, pieces } = piecesOf(sections, size, () => true, true);
		expect(items.map((i) => i.ref)).toEqual([
			'section:controls',
			'lamp',
			'section:scenes',
			'scene:a'
		]);
		const a = pieces.get('scene:a');
		expect(a?.kind === 'card' && a.section.section.id).toBe('scenes');
	});

	it('lays out a hidden card while arranging, so it can be shown again', () => {
		const { items } = piecesOf([section('controls', ['lamp'], ['fan'])], size, () => true, true);
		expect(items.map((i) => i.ref)).toEqual(['section:controls', 'lamp', 'fan']);
		const { items: normally } = piecesOf(
			[section('controls', ['lamp'], ['fan'])],
			size,
			() => true
		);
		expect(normally.map((i) => i.ref)).toEqual(['section:controls', 'lamp']);
	});
});

describe('a card’s sizes (14 §7)', () => {
	const lamp: Card = {
		ref: 'device:l',
		kind: 'device',
		scene: false,
		device: {} as never
	};
	const usual = [
		{ w: 2, h: 1 },
		{ w: 2, h: 2 },
		{ w: 4, h: 3 }
	];

	it('keeps a size within the kind’s smallest and largest', () => {
		const r = rangeOf(lamp, 'light', usual);
		expect(within(r, { w: 1, h: 9 })).toEqual({ w: 2, h: 4 });
		expect(within(rangeOf(lamp, 'tv', usual), { w: 12, h: 5 })).toEqual({ w: 12, h: 5 });
	});

	it('snaps a card that knows only its forms to the nearest', () => {
		const plugin: Card = { ref: 'card:p/e/1', kind: 'plugin', label: 'P' };
		const r = rangeOf(plugin, undefined, usual);
		expect(within(r, { w: 4, h: 2 })).toEqual({ w: 4, h: 3 });
		expect(within(r, { w: 3, h: 1 })).toEqual({ w: 2, h: 1 });
	});

	it('draws the largest form that fits its place', () => {
		const forms = [
			{ form: 'compact' as const, size: usual[0]! },
			{ form: 'standard' as const, size: usual[1]! },
			{ form: 'large' as const, size: usual[2]! }
		];
		expect(formFor({ w: 2, h: 1 }, forms)).toBe('compact');
		expect(formFor({ w: 3, h: 2 }, forms)).toBe('standard');
		expect(formFor({ w: 6, h: 4 }, forms)).toBe('large');
		expect(formFor({ w: 1, h: 1 }, forms)).toBe('compact');
	});
});
