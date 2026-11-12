import { describe, expect, it } from 'vitest';
import { avatarEntry, avatarFile, avatarPicture, personIdOf } from './avatars.js';
import type { Item } from './library.js';

const SAM = '11111111-1111-4111-8111-111111111111';
const RILEY = '22222222-2222-4222-8222-222222222222';

const item = (o: Partial<Item> = {}): Item => ({
	id: 'a'.repeat(24),
	ext: 'jpg',
	name: 'Me',
	kind: 'picture',
	bytes: 10,
	owner: SAM,
	by: 'sam',
	at: '2026-11-12T00:00:00Z',
	shared: false,
	albums: [],
	sizes: {},
	...o
});
const lib = (...items: Item[]) => Object.fromEntries(items.map((it) => [it.id, it]));
const urlOf = (it: Item) => `/ui/pictures/${it.id}.${it.ext}`;

describe('the picture a person shows by', () => {
	it('is a picture of their own, even one nobody else may see in the library', () => {
		const mine = item();
		expect(avatarPicture(SAM, { photo: urlOf(mine) }, lib(mine))).toBe(mine);
	});

	it('is one of everyone’s', () => {
		const shared = item({ owner: RILEY, shared: true });
		expect(avatarPicture(SAM, { photo: urlOf(shared) }, lib(shared))).toBe(shared);
	});

	it('is never someone else’s own, a video, or a file that isn’t ours', () => {
		const theirs = item({ owner: RILEY });
		const video = item({ id: 'b'.repeat(24), ext: 'mp4', kind: 'video' });
		const all = lib(theirs, video);
		expect(avatarPicture(SAM, { photo: urlOf(theirs) }, all)).toBeUndefined();
		expect(avatarPicture(SAM, { photo: urlOf(video) }, all)).toBeUndefined();
		expect(avatarPicture(SAM, { photo: '/ui/pictures/../library.json' }, all)).toBeUndefined();
		expect(
			avatarPicture(SAM, { photo: `/ui/pictures/${'a'.repeat(24)}.png` }, all)
		).toBeUndefined();
		expect(avatarPicture(SAM, { photo: 'https://example.com/me.png' }, all)).toBeUndefined();
		expect(avatarPicture(SAM, undefined, all)).toBeUndefined();
	});
});

describe('a person’s picture for everyone', () => {
	it('is their choice and name, with an address for their photo', () => {
		const mine = item();
		expect(
			avatarEntry(
				SAM,
				{
					username: 'sam',
					photo: urlOf(mine),
					avatar: { kind: 'photo', color: 'nope' },
					favourites: ['device:secret'],
					pages: { home: [] }
				},
				lib(mine)
			)
		).toEqual({
			id: SAM,
			username: 'sam',
			avatar: { kind: 'photo' },
			photo: `/ui/avatars/${SAM}?v=${'a'.repeat(24)}`
		});
	});

	it('is their initials when they chose nothing', () => {
		expect(avatarEntry(RILEY, undefined, {})).toEqual({ id: RILEY, avatar: {} });
	});

	it('sends the tile-sized copy when there is one', () => {
		expect(avatarFile(item())).toBe(`${'a'.repeat(24)}.jpg`);
		expect(avatarFile(item({ sizes: { tile: `${'a'.repeat(24)}.tile.webp` } }))).toBe(
			`${'a'.repeat(24)}.tile.webp`
		);
	});

	it('reads only a person’s id from an address', () => {
		expect(personIdOf('../House/x')).toMatch(/^[0-9a-f-]*$/);
		expect(personIdOf(SAM.toUpperCase())).toBe(SAM);
	});
});
