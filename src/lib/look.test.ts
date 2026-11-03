import { describe, expect, it } from 'vitest';
import type { Change } from './layers.js';
import { lookKey, pageChanges, withoutChanges } from './look.svelte.js';
import { BUILT_IN, LIT, copyOf } from './looks/model.js';

const hide = (ref: string): Change => ({ op: 'hide', ref });

describe('each look keeps its own arrangements (13 §8.4)', () => {
	it('keeps Classic’s where they always were, and another look’s apart', () => {
		expect(lookKey('home', 'classic')).toBe('home');
		expect(lookKey('home', 'lit')).toBe('lit|home');
	});

	it('starts a look from Classic’s arrangement of a page it groups the same way', () => {
		const pages = { home: [hide('section:worth')] };
		expect(pageChanges(pages, 'home', 'lit')).toEqual([hide('section:worth')]);
		// Once it has its own, those are what it shows.
		const mine = { ...pages, 'lit|home': [hide('section:playing')] };
		expect(pageChanges(mine, 'home', 'lit')).toEqual([hide('section:playing')]);
		expect(pageChanges(mine, 'home', 'classic')).toEqual([hide('section:worth')]);
	});

	it('starts a room afresh in a look that groups rooms its own way', () => {
		const pages = { 'room:den': [hide('device:lamp')] };
		expect(pageChanges(pages, 'room:den', 'lit')).toEqual([]);
		expect(pageChanges(pages, 'room:den', 'classic')).toEqual([hide('device:lamp')]);
	});

	it('resets a look to the page as generated, not to Classic’s', () => {
		const pages = { home: [hide('section:worth')], 'lit|home': [hide('section:playing')] };
		const reset = withoutChanges(pages, 'home', 'lit');
		expect(pageChanges(reset, 'home', 'lit')).toEqual([]);
		expect(pageChanges(reset, 'home', 'classic')).toEqual([hide('section:worth')]);
		expect(withoutChanges(pages, 'home', 'classic').home).toBeUndefined();
	});

	it('starts a look made from Lit with Lit’s arrangements, rooms included (U3)', () => {
		const evening = copyOf(LIT, 'Evening', BUILT_IN);
		const all = [...BUILT_IN, evening];
		const pages = {
			'room:den': [hide('device:a')],
			'lit|room:den': [hide('device:b')],
			home: [hide('section:worth')]
		};
		expect(pageChanges(pages, 'room:den', 'evening', all)).toEqual([hide('device:b')]);
		// Home, which Lit hasn't arranged, comes from Classic's through Lit.
		expect(pageChanges(pages, 'home', 'evening', all)).toEqual([hide('section:worth')]);
		expect(lookKey('room:den', 'evening')).toBe('evening|room:den');
	});
});
