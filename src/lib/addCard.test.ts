import { describe, expect, it } from 'vitest';
import { deviceOffer, finds, shelfOf, underRooms } from './addCard.js';
import { roomFromCore } from './house.js';
import { HOUSE, ROOMS } from './fixtures/house.js';

const rooms = ROOMS.map(roomFromCore);
const offers = HOUSE.map((d) => deviceOffer(d, rooms, `device:${d.device_id}`));

describe('shelves', () => {
	it('put each kind on its chip', () => {
		expect(shelfOf('light')).toBe('light');
		expect(shelfOf('fan')).toBe('light');
		expect(shelfOf('temperature_sensor')).toBe('sensor');
		expect(shelfOf('contact_sensor')).toBe('sensor');
		expect(shelfOf('garage')).toBe('lock');
		expect(shelfOf('media_player')).toBe('media');
		expect(shelfOf('timer')).toBe('mode');
		expect(shelfOf('pico_remote')).toBe('hub');
		expect(shelfOf('scene')).toBe('scene');
		expect(shelfOf('sprinkler')).toBe('other');
	});

	it("a plugin's scene says whose it is", () => {
		const scene = offers.find((o) => o.shelf === 'scene');
		expect(scene?.what).toMatch(/^Scene · /);
		expect(scene?.icon).toBe('scene');
	});
});

describe('rooms', () => {
	it('head the list in the rooms’ order, with no room last', () => {
		const groups = underRooms(offers, rooms);
		const order = rooms.map((r) => r.id);
		const ids = groups.map((g) => g.id).filter((id) => id !== '');
		expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
		if (groups.some((g) => g.id === '')) expect(groups.at(-1)?.name).toBe('Not in a room');
		expect(groups.every((g) => g.offers.length > 0)).toBe(true);
	});

	it('sort a room’s things by name', () => {
		for (const g of underRooms(offers, rooms)) {
			const names = g.offers.map((o) => o.name);
			expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
		}
	});
});

describe('search', () => {
	it('needs every word, in any of name, room and kind', () => {
		expect(finds('kitchen light', 'Island Kitchen Light')).toBe(true);
		expect(finds('kitchen lock', 'Island Kitchen Light')).toBe(false);
		expect(finds('  ', 'anything')).toBe(true);
	});
});
