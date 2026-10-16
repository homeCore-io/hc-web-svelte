import { describe, expect, it } from 'vitest';
import { roomFromCore, roomsAfter, type Room } from './house.js';

const den: Room = { id: 'r1', name: 'Den', slug: 'den', aliases: [], deviceIds: ['lamp'] };
const office: Room = { id: 'r2', name: 'Office', slug: 'office', aliases: [], deviceIds: [] };

describe('rooms from homeCore', () => {
	it('keeps the name as typed', () => {
		expect(roomFromCore({ id: 'r', name: 'TV Room', slug: 'tv_room' }).name).toBe('TV Room');
	});

	it('reads a homeCore from before H1, whose name is the slug', () => {
		const r = roomFromCore({ id: 'r', name: 'living_room', device_ids: ['a'] });
		expect(r).toEqual({
			id: 'r',
			name: 'Living room',
			slug: 'living_room',
			aliases: [],
			deviceIds: ['a']
		});
	});
});

describe('rooms after a frame', () => {
	it('takes the snapshot whole, in name order', () => {
		const after = roomsAfter([den], {
			type: 'snapshot',
			rooms: [
				{ id: 'r2', name: 'Office', slug: 'office' },
				{ id: 'r3', name: 'Attic', slug: 'attic' }
			]
		});
		expect(after?.map((r) => r.name)).toEqual(['Attic', 'Office']);
	});

	it('leaves rooms alone for a snapshot the person may not read rooms in', () => {
		expect(roomsAfter([den], { type: 'snapshot' })).toBeUndefined();
	});

	it('follows a rename by id, so the room stays the same room', () => {
		const after = roomsAfter([den, office], {
			type: 'room_changed',
			room: { id: 'r1', name: 'TV Room', slug: 'tv_room', aliases: ['den'], device_ids: ['lamp'] }
		});
		expect(after?.map((r) => [r.id, r.name])).toEqual([
			['r2', 'Office'],
			['r1', 'TV Room']
		]);
	});

	it('adds a room it has not seen', () => {
		const after = roomsAfter([den], {
			type: 'room_changed',
			room: { id: 'r9', name: 'Attic', slug: 'attic' }
		});
		expect(after?.map((r) => r.name)).toEqual(['Attic', 'Den']);
	});

	it('drops a removed room', () => {
		expect(roomsAfter([den, office], { type: 'room_removed', room_id: 'r1' })).toEqual([office]);
	});

	it('ignores frames about other things', () => {
		expect(roomsAfter([den], { type: 'device_state_changed' })).toBeUndefined();
	});
});
