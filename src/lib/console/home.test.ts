import { describe, expect, it } from 'vitest';
import { cardFor } from '../card.js';
import type { CoreDevice } from '../devices.js';
import type { Room } from '../house.js';
import type { Alert } from '../alerts.js';
import { ROOM_BUILT_IN } from '../options.js';
import { roomBox } from '../roomBox.js';
import {
	favoritesOf,
	greetingOf,
	houseLine,
	issuesOf,
	ISSUES_SHOWN,
	playingOf,
	tileOf
} from './home.js';

const dev = (
	id: string,
	type: string,
	name: string,
	attributes: Record<string, unknown> = {},
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name,
	device_type: type,
	plugin_id: 'plugin.test',
	available: true,
	attributes,
	...more
});
const room = (id: string, name: string, slug: string): Room => ({
	id,
	name,
	slug,
	aliases: [],
	deviceIds: []
});
const lockable = { schema: { attributes: { locked: { kind: 'bool' as const, writable: true } } } };
const cards = (list: CoreDevice[]) => list.map((d) => cardFor(d, 0));
const tile = (r: Room, list: CoreDevice[]) =>
	tileOf(r, list, cards(list), roomBox(list, cards(list), {}, ROOM_BUILT_IN));
const alert = (id: string, kind: Alert['kind'], device: string, message: string): Alert => ({
	id,
	kind,
	device_id: device,
	message,
	reason: message,
	severity: 'warning',
	raised_at: '2026-11-12T00:00:00Z'
});

const bath = room('b', 'Bathroom', 'bathroom');
const laundry = room('l', 'Laundry Room', 'laundry_room');
const family = room('f', 'Family Room', 'family_room');

describe('the greeting', () => {
	it('says good morning, afternoon, evening and night', () => {
		expect(greetingOf(3)).toBe('Good night');
		expect(greetingOf(9)).toBe('Good morning');
		expect(greetingOf(14)).toBe('Good afternoon');
		expect(greetingOf(21)).toBe('Good evening');
	});

	it('sums the house up in one line', () => {
		expect(houseLine({ lightsOn: 8, litRooms: 5, playing: 2, working: 3, issues: 0 })).toBe(
			'8 lights on in 5 rooms · 2 playing · 3 thermostats working · all secure'
		);
		expect(houseLine({ lightsOn: 1, litRooms: 1, playing: 0, working: 1, issues: 1 })).toBe(
			'1 light on in 1 room · 1 thermostat working · 1 thing needs attention'
		);
		expect(houseLine({ lightsOn: 0, litRooms: 0, playing: 0, working: 0, issues: 2 })).toBe(
			'Every light off · 2 things need attention'
		);
	});
});

describe('a room’s tile', () => {
	it('says its lights, what plays and what a thermostat is doing', () => {
		const list = [
			dev('a', 'light', 'Desk Lamp', { on: true }),
			dev('b', 'light', 'Floor Lamp', { on: true }),
			dev('c', 'light', 'Overhead', { on: false }),
			dev('t', 'temperature_sensor', 'Temp', { temperature: 21 }, {}),
			dev(
				'r',
				'media_player',
				'Roku Smart Soundbar - YL0001073725',
				{ state: 'playing' },
				{ plugin_id: 'plugin.roku' }
			),
			dev('h', 'thermostat', 'Family Room', { hvac_action: 'cooling' })
		];
		const t = tile(family, list);
		expect(t.status).toBe('2 lights on · Roku Smart Soundbar playing · Cooling');
		expect(t.alarm).toBe(false);
		expect(t.lightsOn).toBe(2);
		expect(t.temp).toMatch(/°$/);
	});

	it('rings a room with a door open or a lock left unlocked', () => {
		const door = tile(bath, [
			dev('m', 'light', 'Mirror', { on: false }),
			dev('d', 'contact_sensor', 'Bathroom Door Sensor', { open: true })
		]);
		expect(door).toMatchObject({ status: 'Lights off · Door open', alarm: true });
		// A speaker named for the room doesn't take the door's name.
		const named = tile(bath, [
			dev('s', 'media_player', 'Bathroom', {}, { plugin_id: 'plugin.sonos' }),
			dev('d', 'contact_sensor', 'Bathroom Door Sensor', { open: true })
		]);
		expect(named.status).toBe('Door open');
		const lock = tile(laundry, [dev('k', 'lock', 'Laundry Room Lock', { locked: false })]);
		expect(lock).toMatchObject({ status: 'Lock unlocked', alarm: true });
	});

	it('counts switches named as lights, and commands on their way', () => {
		const outside = room('o', 'Outside', 'outside');
		const list = [
			dev('a', 'switch', 'Deck Flood Light', { on: true }),
			dev('b', 'switch', 'Garage Door', { on: true }),
			dev('c', 'light', 'Driveway spotlight', { on: false })
		];
		const cs = cards(list);
		const box = roomBox(list, cs, {}, ROOM_BUILT_IN);
		expect(tileOf(outside, list, cs, box)).toMatchObject({ status: '1 light on', lightsOn: 1 });
		const wants = (id: string) => (id === 'c' ? { on: true } : undefined);
		expect(tileOf(outside, list, cs, box, undefined, wants).lightsOn).toBe(2);
	});

	it('is quiet when nothing is on', () => {
		expect(tile(room('e', 'Equipment Room', 'equipment_room'), [])).toMatchObject({
			status: 'Quiet',
			alarm: false,
			lightsOn: 0
		});
	});
});

describe('what needs attention', () => {
	const lock = dev('k', 'lock', 'Laundry Room Lock', { locked: false }, lockable);
	const door = dev('d', 'contact_sensor', 'Bathroom Door Sensor', { open: true });
	const leak = dev('w', 'water_sensor', 'Kitchen Leak Sensor', {}, { area: 'bathroom' });

	it('fixes a lock by locking it, and shows an open door', () => {
		const out = issuesOf(
			[
				{ room: laundry, cards: cards([lock]) },
				{ room: bath, cards: cards([door]) }
			],
			[],
			[lock, door],
			[laundry, bath]
		);
		expect(out).toEqual([
			{
				key: 'unlocked:k',
				text: 'Laundry Room: Lock unlocked',
				act: 'Lock it',
				fix: { lock: 'k' }
			},
			{
				key: 'open:d',
				text: 'Bathroom: Door open',
				act: 'Show',
				fix: { href: '/rooms/b?tab=doors' }
			}
		]);
	});

	it('shows an offline lock or door, and counts its offline alert no more', () => {
		const gone = dev('k', 'lock', 'Laundry Room Lock', { locked: true }, { available: false });
		const shut = dev('d', 'contact_sensor', 'Bathroom Door Sensor', {}, { available: false });
		const bulb = dev('l', 'light', 'Bathroom Light', {}, { available: false });
		const out = issuesOf(
			[
				{ room: laundry, cards: cards([gone]) },
				{ room: bath, cards: cards([shut, bulb]) }
			],
			[alert('offline:k', 'offline', 'k', 'Laundry Room Lock is offline')],
			[gone, shut, bulb],
			[laundry, bath]
		);
		expect(out).toEqual([
			{
				key: 'offline:k',
				text: 'Laundry Room Lock: Offline',
				act: 'Show',
				fix: { href: '/rooms/l?tab=doors' }
			},
			{
				key: 'offline:d',
				text: 'Bathroom Door: Offline',
				act: 'Show',
				fix: { href: '/rooms/b?tab=doors' }
			}
		]);
	});

	it('shows urgent alerts in their room, and counts the rest', () => {
		const out = issuesOf(
			[],
			[
				alert('wet:w', 'wet', 'w', 'Kitchen Leak Sensor is wet'),
				alert('offline:x', 'offline', 'x', 'X is offline'),
				alert('low_battery:y', 'low_battery', 'y', 'Y: battery low')
			],
			[leak],
			[bath]
		);
		expect(out).toEqual([
			{
				key: 'alert:wet:w',
				text: 'Kitchen Leak Sensor is wet',
				act: 'Show',
				fix: { href: '/rooms/b?tab=water' }
			},
			{ key: 'rest', text: '2 other alerts', act: 'See all', fix: { href: '/alerts' } }
		]);
	});

	it('shows only so many, and counts what’s left', () => {
		const doors = Array.from({ length: ISSUES_SHOWN + 2 }, (_, i) =>
			dev(`d${i}`, 'contact_sensor', `Door ${i}`, { open: true })
		);
		const out = issuesOf([{ room: bath, cards: cards(doors) }], [], doors, [bath]);
		expect(out).toHaveLength(ISSUES_SHOWN + 1);
		expect(out.at(-1)).toMatchObject({ text: '2 more things', act: 'See all' });
	});
});

describe('favorites', () => {
	it('keeps the person’s order and adds none of the house’s scenes', () => {
		const lamp = dev('a', 'light', 'Lamp');
		const scenes = [
			{ id: 's1', name: 'Evening' },
			{ id: 's2', name: 'Away' }
		];
		const out = favoritesOf(['scene:s2', 'device:a', 'device:gone'], { a: lamp }, scenes);
		expect(out.map((f) => f.key)).toEqual(['scene:s2', 'device:a']);
	});
});

describe('what’s playing', () => {
	const rooms = [room('o', 'Office', 'office'), room('f', 'Family Room', 'family_room')];
	const now = (d: CoreDevice) =>
		typeof d.attributes.media_title === 'string' ? d.attributes.media_title : undefined;

	it('lists a speaker group once, by its leader, and a screen in an app', () => {
		const list = [
			dev(
				's1',
				'media_player',
				'Office-1',
				{
					state: 'paused',
					media_title: 'Wrong Side of Heaven',
					media_artist: 'Five Finger Death Punch',
					group_members: ['s1', 's2'],
					group_coordinator: 's1'
				},
				{ plugin_id: 'plugin.sonos', area: 'office' }
			),
			dev(
				's2',
				'media_player',
				'Office-2',
				{ state: 'paused', group_members: ['s1', 's2'], group_coordinator: 's1' },
				{ plugin_id: 'plugin.sonos', area: 'office' }
			),
			dev(
				'r',
				'media_player',
				'Roku Smart Soundbar - YL0001073725',
				{ state: 'playing', app_name: 'YouTube' },
				{ plugin_id: 'plugin.roku', area: 'family_room' }
			),
			dev(
				'tv',
				'media_player',
				'Office TV',
				{ app_name: 'Home' },
				{ plugin_id: 'plugin.roku', area: 'office' }
			)
		];
		expect(playingOf(list, rooms, now)).toEqual([
			{
				id: 'r',
				title: 'YouTube',
				sub: 'Family Room · Roku Smart Soundbar · playing',
				screen: true,
				playing: true,
				href: '/rooms/f?tab=media'
			},
			{
				id: 's1',
				title: 'Wrong Side of Heaven',
				sub: 'Five Finger Death Punch · Office · Office-1 + Office-2 · paused',
				screen: false,
				playing: false,
				href: '/rooms/o?tab=media'
			}
		]);
	});

	it('leaves out what is off, offline or has nothing on', () => {
		const list = [
			dev('a', 'media_player', 'A', { on: false, media_title: 'x' }, { plugin_id: 'plugin.sonos' }),
			dev('b', 'media_player', 'B', { media_title: 'x' }, { available: false }),
			dev('c', 'media_player', 'C', {}, { plugin_id: 'plugin.sonos' })
		];
		expect(playingOf(list, rooms, now)).toEqual([]);
	});
});
