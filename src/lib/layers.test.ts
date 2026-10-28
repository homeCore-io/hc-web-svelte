import { describe, expect, it } from 'vitest';
import {
	addChange,
	cardRef,
	ref,
	added,
	apply,
	asks,
	barOf,
	gone,
	layered,
	paletteOf,
	withAsk,
	nudge,
	nudgeFavourite,
	toggleFavourite,
	type Change
} from './layers.js';

const items = ['a', 'b', 'c', 'd'];
const id = (x: string) => x;

describe('a personal layer over a generated page (M2)', () => {
	it('with no changes, the page is as generated', () => {
		expect(apply(items, id).shown).toEqual(items);
	});

	it('hides, and offers the hidden back', () => {
		const l = apply(items, id, [{ op: 'hide', ref: 'b' }]);
		expect(l.shown).toEqual(['a', 'c', 'd']);
		expect(l.hidden).toEqual(['b']);
	});

	it('moves before another, or to the end', () => {
		expect(apply(items, id, [{ op: 'move', ref: 'd', before: 'a' }]).shown).toEqual([
			'd',
			'a',
			'b',
			'c'
		]);
		expect(apply(items, id, [{ op: 'move', ref: 'a', before: null }]).shown).toEqual([
			'b',
			'c',
			'd',
			'a'
		]);
	});

	it('survives the page changing underneath: new items appear, gone ones are skipped', () => {
		const changes: Change[] = [
			{ op: 'move', ref: 'c', before: 'a' },
			{ op: 'hide', ref: 'gone' },
			{ op: 'move', ref: 'gone', before: 'a' }
		];
		expect(apply(['a', 'b', 'c', 'new'], id, changes).shown).toEqual(['c', 'a', 'b', 'new']);
	});

	it('moving before something that has gone puts it last', () => {
		expect(apply(items, id, [{ op: 'move', ref: 'a', before: 'gone' }]).shown).toEqual([
			'b',
			'c',
			'd',
			'a'
		]);
	});

	it('remembers a card’s form', () => {
		const l = apply(items, id, [{ op: 'form', ref: 'b', form: 'large' }]);
		expect(l.form('b')).toBe('large');
		expect(l.form('a')).toBeUndefined();
	});
});

describe('the list of changes stays the size of what was changed', () => {
	it('hide then show leaves one show', () => {
		let list = addChange([], { op: 'hide', ref: 'a' });
		list = addChange(list, { op: 'show', ref: 'a' });
		expect(list).toEqual([{ op: 'show', ref: 'a' }]);
	});

	it('a second move of the same card replaces the first, and goes last', () => {
		let list = addChange([], { op: 'move', ref: 'a', before: 'c' });
		list = addChange(list, { op: 'hide', ref: 'b' });
		list = addChange(list, { op: 'move', ref: 'a', before: null });
		expect(list).toEqual([
			{ op: 'hide', ref: 'b' },
			{ op: 'move', ref: 'a', before: null }
		]);
	});

	it('form and visibility are kept apart', () => {
		let list = addChange([], { op: 'form', ref: 'a', form: 'large' });
		list = addChange(list, { op: 'hide', ref: 'a' });
		expect(list).toHaveLength(2);
	});
});

describe('Customise’s up and down', () => {
	it('up puts it before the one above', () => {
		expect(nudge(items, 'c', -1)).toEqual({ op: 'move', ref: 'c', before: 'b' });
	});

	it('down puts it before the one two along, or last', () => {
		expect(nudge(items, 'b', 1)).toEqual({ op: 'move', ref: 'b', before: 'd' });
		expect(nudge(items, 'c', 1)).toEqual({ op: 'move', ref: 'c', before: null });
	});

	it('does nothing past either end', () => {
		expect(nudge(items, 'a', -1)).toBeUndefined();
		expect(nudge(items, 'd', 1)).toBeUndefined();
	});

	it('and what it makes, applied, moves exactly one place', () => {
		const down = nudge(items, 'b', 1)!;
		expect(apply(items, id, [down]).shown).toEqual(['a', 'c', 'b', 'd']);
	});
});

describe('favourites', () => {
	it('star and unstar', () => {
		expect(toggleFavourite(['x'], 'y')).toEqual(['x', 'y']);
		expect(toggleFavourite(['x', 'y'], 'x')).toEqual(['y']);
	});

	it('reorder', () => {
		expect(nudgeFavourite(['x', 'y', 'z'], 'z', -1)).toEqual(['x', 'z', 'y']);
		expect(nudgeFavourite(['x', 'y'], 'x', -1)).toEqual(['x', 'y']);
	});
});

describe('the phone bar (N2)', () => {
	it('defaults to Home, Pages, Scenes', () => {
		expect(barOf(undefined, [])).toEqual(['home', 'scenes', 'alerts']);
	});

	it('keeps known destinations and real rooms, no repeats, at most four', () => {
		expect(
			barOf(
				{
					version: 1,
					bar: ['home', 'room:r1', 'room:gone', 'nonsense', 'home', 'alerts', 'scenes', 'pages']
				},
				['r1']
			)
		).toEqual(['home', 'room:r1', 'alerts', 'scenes']);
	});

	it('an emptied bar falls back to the default', () => {
		expect(barOf({ version: 1, bar: [] }, [])).toEqual(['home', 'scenes', 'alerts']);
	});
});

describe('the household’s edits under a person’s own (M3)', () => {
	const house: Change[] = [
		{ op: 'hide', ref: 'b' },
		{ op: 'move', ref: 'd', before: 'a' }
	];

	it('everyone sees the household’s edits', () => {
		expect(apply(items, id, layered(house)).shown).toEqual(['d', 'a', 'c']);
	});

	it('a person may show what the household hid, and order it their way', () => {
		const mine: Change[] = [
			{ op: 'show', ref: 'b' },
			{ op: 'move', ref: 'a', before: 'd' }
		];
		expect(apply(items, id, layered(house, mine)).shown).toEqual(['a', 'd', 'b', 'c']);
	});

	it('a renamed card keeps its new label; an empty name puts it back', () => {
		const l = apply(items, id, [{ op: 'rename', ref: 'a', name: ' Porch ' }]);
		expect(l.name('a')).toBe('Porch');
		const back = apply(items, id, [
			{ op: 'rename', ref: 'a', name: 'Porch' },
			{ op: 'rename', ref: 'a', name: '' }
		]);
		expect(back.name('a')).toBeUndefined();
	});
});

describe('cards added to a page', () => {
	it('are listed in the order added, and removing takes them off', () => {
		expect(
			added([
				{ op: 'add', ref: 'x' },
				{ op: 'add', ref: 'y' },
				{ op: 'remove', ref: 'x' }
			])
		).toEqual(['y']);
	});

	it('add then remove leaves one change', () => {
		let list = addChange([], { op: 'add', ref: 'x' });
		list = addChange(list, { op: 'remove', ref: 'x' });
		expect(list).toEqual([{ op: 'remove', ref: 'x' }]);
	});
});

describe('changes naming something that has gone (M2)', () => {
	it('are found, so Edit mode can say so', () => {
		const changes: Change[] = [
			{ op: 'hide', ref: 'a' },
			{ op: 'hide', ref: 'gone' },
			{ op: 'add', ref: 'elsewhere' }
		];
		expect(gone(changes, new Set(['a']))).toEqual([{ op: 'hide', ref: 'gone' }]);
	});
});

describe('the household’s phone bar', () => {
	it('is what anyone without their own sees', () => {
		expect(barOf({ version: 1 }, [], { version: 1, bar: ['home', 'alerts'] })).toEqual([
			'home',
			'alerts'
		]);
	});

	it('a person’s own still wins', () => {
		expect(barOf({ version: 1, bar: ['search'] }, [], { version: 1, bar: ['home'] })).toEqual([
			'search'
		]);
	});
});

describe('asking before a command (D2)', () => {
	it('follows the device unless someone said otherwise', () => {
		expect(asks(undefined, 'd', 'lock', true)).toBe(true);
		expect(asks(undefined, 'd', 'lock', false)).toBe(false);
	});

	it('a choice for the kind applies to every device of it', () => {
		const house = { version: 1, confirm: { kinds: { lock: 'always' as const } } };
		expect(asks(house, 'front', 'lock', false)).toBe(true);
	});

	it('a choice for the device beats the kind’s', () => {
		const house = {
			version: 1,
			confirm: { kinds: { lock: 'always' as const }, devices: { shed: 'never' as const } }
		};
		expect(asks(house, 'shed', 'lock', true)).toBe(false);
		expect(asks(house, 'front', 'lock', false)).toBe(true);
	});
});

describe('setting who is asked', () => {
	it('sets and clears one choice, leaving the rest', () => {
		let doc = withAsk({ version: 3 }, 'kinds', 'lock', 'always');
		doc = withAsk(doc, 'devices', 'shed', 'never');
		expect(doc.confirm).toEqual({ kinds: { lock: 'always' }, devices: { shed: 'never' } });
		doc = withAsk(doc, 'kinds', 'lock', undefined);
		expect(doc.confirm).toEqual({ kinds: {}, devices: { shed: 'never' } });
		expect(doc.version).toBe(3);
	});
});

describe('themes (D9a)', () => {
	it('a person’s own, else the house’s, else Amber; unknown ones are ignored', () => {
		expect(paletteOf()).toBe('amber');
		expect(paletteOf({ version: 1 }, { version: 1, palette: 'sage' })).toBe('sage');
		expect(paletteOf({ version: 1, palette: 'plum' }, { version: 1, palette: 'sage' })).toBe(
			'plum'
		);
		expect(paletteOf({ version: 1, palette: 'neon' }, { version: 1 })).toBe('amber');
	});
});

describe('plugin cards on a page', () => {
	it('a card is added with its own ref, and its settings are the last ones given', () => {
		const r = ref.card('plugin.wled', 'hc-wled-presets', 'a1');
		expect(r).toBe('card:plugin.wled/hc-wled-presets/a1');
		expect(cardRef(r)).toEqual({ pluginId: 'plugin.wled', element: 'hc-wled-presets', n: 'a1' });
		expect(cardRef('device:x')).toBeUndefined();
		let list = addChange([], { op: 'add', ref: r });
		list = addChange(list, { op: 'config', ref: r, config: { presets: [1] } });
		list = addChange(list, { op: 'config', ref: r, config: { presets: [14, 16] } });
		expect(list.filter((c) => c.op === 'config')).toHaveLength(1);
		const l = apply([r], (x) => x, list);
		expect(l.config(r)).toEqual({ presets: [14, 16] });
		expect(added(list)).toEqual([r]);
	});
});
