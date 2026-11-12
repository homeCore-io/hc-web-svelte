import { describe, expect, it } from 'vitest';
import type { PersonDoc } from '../layers.js';
import { faderStyle, switchesAs, sidebarOf, switchStyle, withConsole, withPrefs } from './style.js';

describe('the console’s controls, as each person sees them', () => {
	it('draws them Machined and Precision until someone chooses', () => {
		expect(faderStyle()).toBe('machined');
		expect(switchStyle()).toBe('precision');
		expect(faderStyle({}, {})).toBe('machined');
	});

	it('takes the household’s style for anyone who hasn’t chosen', () => {
		const house = { fader: 'glass', switch: 'keypad' } as const;
		expect(faderStyle(undefined, house)).toBe('glass');
		expect(switchStyle({}, house)).toBe('keypad');
	});

	it('puts the person’s own choice over the household’s', () => {
		const house = { fader: 'glass', switch: 'keypad' } as const;
		expect(faderStyle({ fader: 'lightbar' }, house)).toBe('lightbar');
		expect(switchStyle({ switch: 'offon' }, house)).toBe('offon');
	});

	it('treats a style it doesn’t know as unset', () => {
		const odd = { fader: 'wood', switch: 'rocker' } as never;
		expect(faderStyle(odd, { fader: 'glass' })).toBe('glass');
		expect(switchStyle(odd, odd)).toBe('precision');
	});
});

describe('the console’s sidebar', () => {
	it('is open until the person folds it', () => {
		expect(sidebarOf()).toBe('open');
		expect(sidebarOf({ sidebar: 'folded' })).toBe('folded');
		expect(sidebarOf({ sidebar: 'sideways' } as never)).toBe('open');
	});
});

describe('switches and timers together', () => {
	it('sit as rows until the person picks tiles', () => {
		expect(switchesAs()).toBe('rows');
		expect(switchesAs({ switchesAs: 'tiles' })).toBe('tiles');
		expect(switchesAs({ switchesAs: 'grid' } as never)).toBe('rows');
	});

	it('keep tiles as a choice, and rows as none', () => {
		expect(withPrefs({ fader: 'glass' }, { switchesAs: 'tiles' })).toEqual({
			fader: 'glass',
			switchesAs: 'tiles'
		});
		expect(withPrefs({ switchesAs: 'tiles' }, { switchesAs: 'rows' })).toBeUndefined();
	});
});

describe('changing a person’s console choices', () => {
	it('sets one choice and keeps the others', () => {
		expect(withPrefs({ fader: 'glass' }, { sidebar: 'folded' })).toEqual({
			fader: 'glass',
			sidebar: 'folded'
		});
	});

	it('takes a choice out when it goes back to the default, and leaves nothing when none are left', () => {
		expect(withPrefs({ fader: 'glass', switch: 'keypad' }, { fader: undefined })).toEqual({
			switch: 'keypad'
		});
		expect(withPrefs({ fader: 'glass' }, { fader: undefined })).toBeUndefined();
	});

	it('drops what it doesn’t know', () => {
		expect(withPrefs(undefined, { fader: 'wood', sidebar: 'open' })).toEqual({ sidebar: 'open' });
	});

	it('changes the preferences document, leaving the rest of it alone', () => {
		const doc: PersonDoc = { version: 3, look: 'console' };
		expect(withConsole(doc, { switch: 'offon' })).toEqual({
			version: 3,
			look: 'console',
			console: { switch: 'offon' }
		});
		expect(
			withConsole({ ...doc, console: { switch: 'offon' as const } }, { switch: undefined })
		).toEqual(doc);
	});
});
