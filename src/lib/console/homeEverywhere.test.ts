// Home and Everywhere count the same house: one fixture through both, so a
// tile, Home's line and Everywhere's rows never disagree on lights on or
// what's playing (the drift behind code-2 to code-4 of the deep check).
import { describe, expect, it } from 'vitest';
import { FIXTURE_NOW, HOUSE, ROOMS } from '../fixtures/house.js';
import { cardFor } from '../card.js';
import type { CoreDevice, Devices } from '../devices.js';
import type { Room } from '../house.js';
import { roomBox } from '../roomBox.js';
import { ROOM_BUILT_IN } from '../options.js';
import { byRoom } from '../summary.js';
import { isLit, lightsCount as houseLights } from '../lights.js';
import { playingOf, tileOf } from './home.js';
import {
	everyRoom,
	lightRows,
	lightsCount,
	placesOf,
	playerRows,
	playingNow
} from './everywhere.js';
import { devicesIn } from './room.js';

const rooms = ROOMS.map((r) => ({ aliases: [], ...r })) as unknown as Room[];

/** A house with some lights on and something playing, as Home and Everywhere see it. */
function both(list: CoreDevice[]) {
	const byId: Devices = Object.fromEntries(list.map((d) => [d.device_id, d]));
	const places = placesOf(byRoom(byId, rooms), everyRoom(rooms, rooms));
	const rows = lightRows(places);
	const home = rooms.map((room) => {
		const inRoom = devicesIn(byId, room);
		const cards = inRoom.map((d) => cardFor(d, FIXTURE_NOW));
		const box = roomBox(inRoom, cards, byId, ROOM_BUILT_IN);
		const lights = rows.find((r) => r.place.room?.id === room.id)?.lights ?? [];
		return { room, tile: tileOf(room, inRoom, cards, box, lights, () => undefined, list) };
	});
	return { places, rows, home, byId };
}

describe('Home and Everywhere, for the same house', () => {
	const { places, rows, home } = both(HOUSE);

	it('count the same lights on, room by room and in all', () => {
		const everywhere = lightsCount(rows);
		// Home's line counts the same rows (homeNow.svelte.ts).
		const homeLine = houseLights(rows.map((r) => ({ room: r.place.room, lights: r.lights })));
		expect(homeLine).toEqual(everywhere);
		expect(everywhere.on).toBeGreaterThan(0);
		for (const { room, tile } of home) {
			const row = rows.find((r) => r.place.room?.id === room.id);
			expect([room.name, tile.lightsOn]).toEqual([
				room.name,
				row?.lights.filter((d) => isLit(d)).length ?? 0
			]);
		}
		// The tiles' lights, and those in no room, are the house's.
		const tiles = home.reduce((n, h) => n + h.tile.lightsOn, 0);
		expect(tiles + everywhere.loose).toBe(everywhere.on);
	});

	it('count the same players playing', () => {
		const homePlaying = playingOf(HOUSE, rooms)
			.filter((p) => p.playing)
			.map((p) => p.id)
			.sort();
		const everywhere = playingNow(playerRows(places))
			.map((r) => r.device.device_id)
			.sort();
		expect(homePlaying).toEqual(everywhere);
		expect(everywhere.length).toBeGreaterThan(0);
	});

	it('agree when a light goes offline: it is off in both', () => {
		const on = rows.flatMap((r) => r.lights).find((d) => isLit(d));
		expect(on).toBeDefined();
		const after = both(HOUSE.map((d) => (d === on ? { ...d, available: false } : d)));
		const everywhere = lightsCount(after.rows);
		expect(everywhere.on).toBe(lightsCount(rows).on - 1);
		const tiles = after.home.reduce((n, h) => n + h.tile.lightsOn, 0);
		expect(tiles + everywhere.loose).toBe(everywhere.on);
	});
});
