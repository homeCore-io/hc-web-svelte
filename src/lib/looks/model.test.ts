import { describe, expect, it } from 'vitest';
import {
	BUILT_IN,
	sizeOf,
	areaFor,
	areasOf,
	narrowArea,
	readAreas,
	CLASSIC,
	LIT,
	allLooks,
	copyOf,
	drawingOf,
	feelVars,
	fromFile,
	lookFile,
	reachesHere,
	readLook,
	type Look
} from './model.js';

describe('a look as data (13 §15)', () => {
	it('fills what a look leaves out from the look it was made from', () => {
		const l = readLook({ id: 'evening', name: 'Evening', from: 'lit', version: 1 }) as Look;
		expect(l.feel).toEqual(LIT.feel);
		expect(drawingOf(l, 'lights')).toBe('lit');
		expect(l.grouping.room).toEqual(LIT.grouping.room);
		const plain = readLook({ id: 'plain', name: 'Plain', version: 1 }) as Look;
		expect(plain.feel).toEqual(CLASSIC.feel);
		expect(plain.grouping.room).toBeUndefined();
	});

	it('keeps the choices it makes, and drops what it can’t use', () => {
		const l = readLook({
			id: 'mixed',
			name: 'Mixed',
			from: 'lit',
			version: 1,
			feel: { density: 'roomy', type: 3, motion: 'wild' },
			drawings: { lights: 'classic', doors: 'acme-orb' },
			grouping: { room: [{ id: 'lights', title: 'Lights', takes: ['lights', 'nonsense'] }] }
		}) as Look;
		expect(l.feel).toEqual({ density: 'roomy', corners: 'round', type: 1.15, motion: 'lively' });
		expect(drawingOf(l, 'lights')).toBe('classic');
		expect(drawingOf(l, 'doors')).toBe('lit');
		expect(l.grouping.room).toEqual([
			{ id: 'lights', title: 'Lights', takes: ['lights'], layout: 'grid', place: 'main' }
		]);
	});

	it('goes back to Classic’s rooms when a look says so', () => {
		const l = readLook({ id: 'x', name: 'X', from: 'lit', version: 1, grouping: { room: null } });
		expect((l as Look).grouping.room).toBeUndefined();
	});

	it('says why something isn’t a look', () => {
		expect(readLook('nope')).toBe('This isn’t a look.');
		expect(readLook({ id: 'x', name: 'X', version: 2 })).toBe(
			'This look is from a newer homeCore.'
		);
		expect(readLook({ id: 'Bad Id', name: 'X', version: 1 })).toMatch(/no id/);
		expect(readLook({ id: 'lit', name: 'X', version: 1 })).toMatch(/built-in/);
		expect(
			readLook({
				id: 'x',
				name: 'X',
				version: 1,
				grouping: {
					room: [
						{ id: 'a', title: 'A' },
						{ id: 'a', title: 'B' }
					]
				}
			})
		).toMatch(/share an id/);
	});

	it('lists the built-in looks first, then the house’s, then a person’s, skipping the broken', () => {
		const all = allLooks(
			[{ id: 'ours', name: 'Ours', version: 1 }, { nonsense: true }],
			[{ id: 'mine', name: 'Mine', from: 'ours', version: 1 }]
		);
		expect(all.map((l) => l.id)).toEqual(['classic', 'lit', 'ours', 'mine']);
	});

	it('turns a feel into the tokens components read', () => {
		expect(feelVars(LIT.feel)['--feel-card-radius']).toBe('18px');
		expect(feelVars(CLASSIC.feel)['--feel-gap']).toBe('10px');
	});
});

describe('sharing a look (13 §12.3)', () => {
	it('copies a look under a new id, naming where it came from', () => {
		const a = copyOf(LIT, 'Lit', BUILT_IN);
		expect(a.id).toBe('lit-2');
		expect(a.from).toBe('lit');
		expect(a.grouping.room).not.toBe(LIT.grouping.room);
	});

	it('reads back a file it wrote', () => {
		const evening = copyOf(LIT, 'Evening', BUILT_IN);
		expect(fromFile(lookFile(evening), BUILT_IN)).toEqual(evening);
	});

	it('refuses a file that isn’t a look', () => {
		expect(fromFile('{', BUILT_IN)).toBe('This file isn’t a look.');
		expect(fromFile('{"look":{}}', BUILT_IN)).toBe('This file isn’t a look.');
	});
});

describe('where a look reaches (S9)', () => {
	it('reaches the household’s pages always, and settings only when it says everywhere', () => {
		for (const p of ['/', '/rooms/abc', '/pages/x', '/scenes', '/alerts'])
			expect(reachesHere(LIT, p), p).toBe(true);
		for (const p of ['/settings/look', '/me', '/rules', '/roomsx'])
			expect(reachesHere(LIT, p), p).toBe(false);
		expect(reachesHere({ ...LIT, reaches: 'everywhere' }, '/settings')).toBe(true);
	});
});

describe('a plugin’s drawings and pieces in a look (13 §12)', () => {
	it('keeps a plugin’s drawing, header and rest view by id, and drops what isn’t one', () => {
		const l = readLook({
			id: 'p',
			name: 'P',
			from: 'lit',
			version: 1,
			drawings: { lights: 'plugin:plugin.acme/acme-orb', doors: 'plugin:../../etc' },
			frame: {
				header: 'plugin:plugin.acme/acme-banner',
				rest: { piece: 'plugin:plugin.acme/acme-rest' }
			}
		}) as Look;
		expect(drawingOf(l, 'lights')).toBe('plugin:plugin.acme/acme-orb');
		expect(drawingOf(l, 'doors')).toBe('lit');
		expect(l.frame.header).toBe('plugin:plugin.acme/acme-banner');
		expect(l.frame.rest.piece).toBe('plugin:plugin.acme/acme-rest');
	});

	it('keeps the drawings of the look it was made from, made ones included', () => {
		const base = readLook({
			id: 'base',
			name: 'Base',
			version: 1,
			made: [{ id: 'orb', name: 'Orb', family: 'lights', from: 'lit' }],
			drawings: { lights: 'orb', switches: 'plugin:plugin.acme/acme-rocker' }
		}) as Look;
		const child = readLook({ id: 'child', name: 'Child', from: 'base', version: 1 }, [
			...BUILT_IN,
			base
		]) as Look;
		expect(drawingOf(child, 'lights')).toBe('orb');
		expect(drawingOf(child, 'switches')).toBe('plugin:plugin.acme/acme-rocker');
	});
});

describe('options for drawings', () => {
	it('keeps on-or-off choices for plugins’ and extensions’ drawings, and nothing else', () => {
		const l = readLook({
			id: 'mine',
			name: 'Mine',
			from: 'lit',
			version: 1,
			options: {
				'ext:hc-thermostat/dial': { pulse: false, colour: 'red', 'Bad name': true },
				'plugin:plugin.x/hc-x-dial': { glow: true },
				lit: { pulse: true },
				'ext:empty/x': { n: 3 }
			}
		});
		expect(typeof l === 'string' ? l : l.options).toEqual({
			'ext:hc-thermostat/dial': { pulse: false },
			'plugin:plugin.x/hc-x-dial': { glow: true }
		});
		const plain = readLook({ id: 'p', name: 'P', version: 1 });
		expect(typeof plain === 'string' ? plain : plain.options).toBeUndefined();
	});
});

describe('a look’s areas (14 §8, A1 to A3)', () => {
	const rule = (id: string, place: 'band' | 'main' | 'side', area?: string) => ({
		id,
		title: id,
		takes: [],
		layout: 'grid' as const,
		place,
		...(area ? { area } : {})
	});

	it('has Lit’s when it says none: across the top, then main and beside', () => {
		expect(areasOf({}).map((a) => [a.id, a.x, a.w, a.row])).toEqual([
			['top', 0, 12, 0],
			['main', 0, 8, 1],
			['beside', 8, 4, 1]
		]);
	});

	it('starts a section in its rule’s area, else where its place meant, and the rest last', () => {
		const g = {
			areas: [
				[
					{ id: 'rail', name: 'Rail', w: 3 },
					{ id: 'main', name: 'Main', w: 9 }
				]
			]
		};
		expect(areaFor(g, rule('a', 'main', 'rail'))?.id).toBe('rail');
		expect(areaFor(g, rule('b', 'main'))?.id).toBe('main');
		expect(areaFor(g, rule('c', 'band'))?.id).toBe('rail');
		expect(areaFor(g, undefined)?.id).toBe('main');
		expect(narrowArea({ id: 'rail', name: 'Rail', w: 3 })).toBe(true);
		const three = {
			areas: [
				[
					{ id: 'a', name: 'A', w: 3 },
					{ id: 'b', name: 'B', w: 6 },
					{ id: 'c', name: 'C', w: 3 }
				]
			]
		};
		expect(areaFor(three, rule('d', 'main'))?.id).toBe('b');
		expect(areaFor(three, rule('e', 'side'))?.id).toBe('a');
	});

	it('reads only areas that fit: known ids, none repeated, rows of 12 or less', () => {
		expect(
			readAreas([
				[
					{ id: 'a', name: 'A', w: 6 },
					{ id: 'b', name: 'B', w: 6 }
				]
			])
		).toHaveLength(1);
		expect(
			readAreas([
				[
					{ id: 'a', name: 'A', w: 8 },
					{ id: 'b', name: 'B', w: 6 }
				]
			])
		).toBeUndefined();
		expect(readAreas([[{ id: 'a', w: 6 }], [{ id: 'a', w: 6 }]])).toBeUndefined();
		expect(readAreas([[{ id: 'Bad id', w: 6 }]])).toBeUndefined();
		expect(readAreas('rows')).toBeUndefined();
	});
});

describe('a made drawing’s size (14 §7, L4)', () => {
	const made = (size?: unknown) =>
		readLook({
			version: 1,
			id: 'mine',
			name: 'Mine',
			made: [{ id: 'orb', name: 'Orb', family: 'lights', from: 'lit', ...(size ? { size } : {}) }]
		});

	it('keeps a range of the editor’s sizes, the smaller first', () => {
		const l = made({ min: [2, 2], max: [6, 4] });
		expect(typeof l !== 'string' && l.made[0]?.size).toEqual({ min: [2, 2], max: [6, 4] });
	});

	it('takes its family’s when it says none, or one that doesn’t fit', () => {
		for (const size of [undefined, { min: [6, 4], max: [2, 1] }, { min: [5, 5], max: [6, 4] }]) {
			const l = made(size);
			expect(typeof l !== 'string' && l.made[0] && sizeOf(l.made[0])).toEqual({
				min: [2, 1],
				max: [6, 4]
			});
		}
	});
});
