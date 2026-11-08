import { describe, expect, it } from 'vitest';
import { piecesOf } from './freePage.js';
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
