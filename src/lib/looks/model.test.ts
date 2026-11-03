import { describe, expect, it } from 'vitest';
import {
	BUILT_IN,
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
