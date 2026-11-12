import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarView, choiceOf, colorFor, ICON_IDS, initialsOf } from './avatar.js';

describe('initials from a name', () => {
	it('takes the first letters of the first two words', () => {
		expect(initialsOf('Alex Lee')).toBe('AL');
		expect(initialsOf('mary jane watson')).toBe('MJ');
		expect(initialsOf('j.doe')).toBe('JD');
		expect(initialsOf('sam_riley')).toBe('SR');
	});

	it('takes the first two letters of one word', () => {
		expect(initialsOf('alex')).toBe('AL');
		expect(initialsOf('admin')).toBe('AD');
		expect(initialsOf('Q')).toBe('Q');
	});

	it('keeps letters beyond English, and has something for no name', () => {
		expect(initialsOf('élodie ørsted')).toBe('ÉØ');
		expect(initialsOf('')).toBe('?');
		expect(initialsOf('  !! ')).toBe('?');
	});
});

describe('a person’s own color', () => {
	it('is one of the eight, the same each time', () => {
		const c = colorFor('a4d76f79-3cda-4c1c-9749-a87ab0c4c40c');
		expect(AVATAR_COLORS).toContain(c);
		expect(colorFor('a4d76f79-3cda-4c1c-9749-a87ab0c4c40c')).toBe(c);
	});

	it('differs between people', () => {
		const ids = Array.from({ length: 40 }, (_, i) => `person-${i}`);
		expect(new Set(ids.map(colorFor)).size).toBeGreaterThan(4);
	});
});

describe('a person’s choice, read from their document', () => {
	it('keeps what it knows and leaves out the rest', () => {
		expect(
			choiceOf({ kind: 'icon', initials: 'x!yz', color: '#1f9d74', icon: 'paw', extra: 1 })
		).toEqual({ kind: 'icon', initials: 'XY', color: '#1f9d74', icon: 'paw' });
		expect(choiceOf({ kind: 'video', initials: '!!', color: 'red', icon: 'skull' })).toEqual({});
		expect(choiceOf('photo')).toEqual({});
		expect(choiceOf(null)).toEqual({});
	});

	it('has the board’s eight icons and eight colors', () => {
		expect(ICON_IDS).toEqual(['leaf', 'star', 'moon', 'paw', 'bolt', 'music', 'sun', 'coffee']);
		expect(AVATAR_COLORS).toHaveLength(8);
	});
});

describe('how a person’s picture is drawn', () => {
	const who = { id: 'p1', name: 'Alex Lee' };

	it('is their initials on their own color by default', () => {
		expect(avatarView(undefined, undefined, who)).toEqual({
			kind: 'initials',
			initials: 'AL',
			color: colorFor('p1'),
			icon: 'leaf'
		});
	});

	it('is what they chose', () => {
		expect(avatarView({ kind: 'icon', icon: 'moon', color: '#9b59d0' }, undefined, who)).toEqual({
			kind: 'icon',
			initials: 'AL',
			color: '#9b59d0',
			icon: 'moon'
		});
		expect(avatarView({ initials: 'ZZ' }, undefined, who).initials).toBe('ZZ');
	});

	it('is their photo when they chose it, and their initials once it’s gone', () => {
		expect(avatarView({ kind: 'photo' }, '/ui/avatars/p1?v=1', who)).toMatchObject({
			kind: 'photo',
			photo: '/ui/avatars/p1?v=1'
		});
		expect(avatarView({ kind: 'photo' }, undefined, who).kind).toBe('initials');
	});

	it('keeps a photo from before there was a choice, unless they chose otherwise', () => {
		expect(avatarView(undefined, '/x.png', who).kind).toBe('photo');
		expect(avatarView({ kind: 'initials' }, '/x.png', who)).not.toHaveProperty('photo');
	});
});
