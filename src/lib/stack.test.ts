import { describe, expect, it } from 'vitest';
import type { Change } from './layers.js';
import { applyPage, type Page } from './page.js';
import { across, readStack, stacked, stackHeight, stackRows } from './stack.js';

const S = 'kind:stack/a';
const T = 'kind:stack/b';
const config = (ref: string, config: Record<string, unknown>): Change => ({
	op: 'config',
	ref,
	config
});

describe('a stack’s settings (13 §13.2)', () => {
	it('reads what it can and defaults the rest', () => {
		expect(readStack({})).toEqual({
			name: '',
			style: 'list',
			height: 'fit',
			busyFirst: false,
			things: []
		});
		expect(
			readStack({ name: ' Doors ', style: 'keypad', height: '3', order: 'busy', things: [] })
		).toMatchObject({ name: 'Doors', style: 'keypad', height: '3', busyFirst: true });
		expect(readStack({ style: 'swirl', height: '9' })).toMatchObject({
			style: 'list',
			height: 'fit'
		});
	});

	it('holds devices and scenes, once each, never another card', () => {
		expect(
			readStack({ things: ['device:a', 'scene:b', 'device:a', 'kind:stack/x', 'card:p/e/1', 7] })
				.things
		).toEqual(['device:a', 'scene:b']);
	});
});

describe('which stack a thing is in', () => {
	it('takes the last things any layer set, for stacks on the page', () => {
		const m = stacked(
			[
				config(S, { things: ['device:a', 'device:b'] }),
				config(S, { style: 'pills' }),
				config(S, { things: ['device:b'] }),
				config('kind:stack/gone', { things: ['device:c'] })
			],
			[{ ref: S }]
		);
		expect([...m]).toEqual([['device:b', S]]);
	});

	it('puts a thing two stacks name in the first one', () => {
		const m = stacked(
			[config(T, { things: ['device:a'] }), config(S, { things: ['device:a', 'scene:z'] })],
			[{ ref: S }, { ref: T }]
		);
		expect(m.get('device:a')).toBe(S);
		expect(m.get('scene:z')).toBe(S);
	});
});

describe('a thing in a stack is on the page once', () => {
	const page: Page = {
		id: 'room:garage',
		cardTools: true,
		sections: [
			{
				id: 'devices:controls',
				title: 'Controls',
				layout: 'grid',
				cards: [
					{ ref: 'scene:x', kind: 'scene', id: 'x', name: 'X' },
					{ ref: 'scene:y', kind: 'scene', id: 'y', name: 'Y' },
					{ ref: S, kind: 'stack', added: true }
				]
			},
			{
				id: 'favourites',
				title: 'Favorites',
				layout: 'grid',
				favourites: true,
				cards: [{ ref: 'scene:x', kind: 'scene', id: 'x', name: 'X' }]
			}
		]
	};
	const refsIn = (changes: Change[], id: string) =>
		applyPage(page, changes)
			.sections.find((s) => s.section.id === id)!
			.groups.flatMap((g) => g.shown.map((c) => c.ref));

	it('leaves its section while it’s in a stack, and comes back when taken out', () => {
		expect(refsIn([config(S, { things: ['scene:x'] })], 'devices:controls')).toEqual([
			'scene:y',
			S
		]);
		expect(refsIn([config(S, { things: [] })], 'devices:controls')).toEqual([
			'scene:x',
			'scene:y',
			S
		]);
	});

	it('stays in Favorites, which are each person’s own', () => {
		expect(refsIn([config(S, { things: ['scene:x'] })], 'favourites')).toEqual(['scene:x']);
	});

	it('stays where it is when the stack isn’t on the page', () => {
		expect(
			refsIn([config('kind:stack/elsewhere', { things: ['scene:x'] })], 'devices:controls')
		).toEqual(['scene:x', 'scene:y', S]);
	});
});

describe('how much room a stack takes', () => {
	const s = (o: Record<string, unknown>) => readStack(o);
	it('fits its things, in card rows of the grid', () => {
		expect(stackRows(s({}), false, 0)).toBe(1);
		expect(stackRows(s({}), false, 7)).toBe(3);
		// Two wide: two columns, so half as tall.
		expect(stackRows(s({}), true, 7)).toBe(2);
		expect(stackRows(s({ style: 'rockers' }), false, 7)).toBe(3);
		expect(across('rockers', true)).toBe(4);
	});

	it('is as tall as it was set to, scrolling inside past that', () => {
		expect(stackRows(s({ height: '2' }), false, 30)).toBe(2);
		expect(stackHeight(2)).toBe(242);
		expect(stackHeight(3)).toBe(368);
	});
});

describe('a stack a look’s grouping made', () => {
	it('holds what it was given until a layer chooses', () => {
		const g = [{ ref: S, things: ['device:a', 'device:b'] }];
		expect([...stacked([], g).keys()]).toEqual(['device:a', 'device:b']);
		expect([...stacked([config(S, { things: ['device:b'] })], g).keys()]).toEqual(['device:b']);
		// A style alone leaves what it holds.
		expect([...stacked([config(S, { style: 'pills' })], g).keys()]).toEqual([
			'device:a',
			'device:b'
		]);
	});
});

describe('what each stack draws', () => {
	it('is what it holds, a thing two stacks name in the first only', () => {
		const page: Page = {
			id: 'room:x',
			cardTools: true,
			sections: [
				{
					id: 'a',
					title: 'A',
					layout: 'grid',
					cards: [
						{ ref: S, kind: 'stack', things: ['device:a', 'device:b'] },
						{ ref: T, kind: 'stack', things: ['device:b', 'device:c'] }
					]
				}
			]
		};
		const held = applyPage(page)
			.sections[0]!.groups.flatMap((g) => g.shown)
			.map((c) => (c.kind === 'stack' ? c.held : undefined));
		expect(held).toEqual([['device:a', 'device:b'], ['device:c']]);
	});
});

describe('a stack someone filled and one a grouping filled', () => {
	it('gives a thing both name to the one someone chose it for', () => {
		const m = stacked(
			[config(T, { things: ['device:b'] })],
			[{ ref: S, things: ['device:a', 'device:b'] }, { ref: T }]
		);
		expect(m.get('device:b')).toBe(T);
		expect(m.get('device:a')).toBe(S);
	});
});
