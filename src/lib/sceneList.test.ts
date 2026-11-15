import { describe, expect, it } from 'vitest';
import {
	findPicks,
	lastRunOf,
	lastRunText,
	pickable,
	providers,
	sceneCounts,
	sceneDetail,
	sceneRows,
	shownScenes,
	sortScenes,
	withRefs
} from './sceneList.js';
import type { CoreDevice } from './devices.js';
import type { Room } from './house.js';
import type { CoreScene } from './scenes.svelte.js';

const dev = (id: string, o: Partial<CoreDevice>): CoreDevice => ({
	device_id: id,
	name: id,
	available: true,
	device_type: 'scene',
	attributes: {},
	...o
});
const room = (id: string, name: string): Room => ({
	id,
	name,
	slug: id,
	aliases: [],
	deviceIds: []
});
const rooms = [room('office', 'Office'), room('family_room', 'Family Room'), room('den', 'Den')];
const hue = (id: string, name: string, area: string, group: string, o: Partial<CoreDevice> = {}) =>
	dev(id, {
		name,
		plugin_id: 'plugin.hue',
		area,
		attributes: { kind: 'hue_scene', active: false, group_name: group, group_kind: 'room' },
		...o
	});

const devices = {
	away: dev('away', {
		name: 'Away Scene',
		plugin_id: 'plugin.lutron',
		attributes: { on: false, phantom_button: 80 }
	}),
	deck: dev('deck', {
		name: 'Deck On',
		plugin_id: 'plugin.lutron',
		area: 'den',
		attributes: { on: true }
	}),
	sol: dev('sol', { name: 'Solstice', plugin_id: 'plugin.caseta' }),
	tt1: hue('tt1', 'Tropical twilight', 'office', 'Office'),
	tt2: hue('tt2', 'Tropical twilight', 'family_room', 'Family Room', {
		attributes: { kind: 'hue_scene', active: true, group_name: 'Family Room', group_kind: 'room' }
	}),
	relax: hue('relax', 'Relax', 'den', 'Den'),
	lamp: dev('lamp', { device_type: 'light', attributes: { on: true } })
};
const scenes: CoreScene[] = [{ id: 'eve', name: 'Evening', states: { a: {}, b: {} } }];

describe('sceneDetail', () => {
	it('says where a plugin keeps its scene', () => {
		expect(sceneDetail(devices.away)).toBe('Phantom button 80');
		expect(sceneDetail(devices.deck)).toBe('Keypad scene');
		expect(sceneDetail(devices.tt1)).toBe('Office (room)');
		expect(
			sceneDetail(hue('z', 'Z', '', 'Downstairs', { attributes: { group_name: 'Downstairs' } }))
		).toBe('Downstairs');
		expect(sceneDetail(devices.sol)).toBe('');
	});
});

describe('sceneRows', () => {
	const rows = sceneRows(devices, scenes, rooms, ['device:away', 'device:tt1']);
	const by = (name: string) => rows.find((r) => r.name === name)!;

	it('lists homeCore’s scenes and every plugin scene, not other devices, by name', () => {
		expect(rows.map((r) => r.name)).toEqual([
			'Away Scene',
			'Deck On',
			'Evening',
			'Relax',
			'Solstice',
			'Tropical twilight'
		]);
	});

	it('says who provides each, and how it is now where it can tell', () => {
		expect(by('Evening')).toMatchObject({
			from: 'homeCore',
			detail: '2 devices',
			now: 'n/a',
			roomText: 'No room',
			href: '/settings/scenes/eve',
			core: true
		});
		expect(by('Away Scene')).toMatchObject({ from: 'Lutron', now: 'Off', onHome: true });
		expect(by('Deck On')).toMatchObject({ now: 'Active', active: true, roomText: 'Den' });
		expect(by('Solstice')).toMatchObject({ from: 'Caséta', now: 'Off', detail: '' });
		expect(by('Relax')).toMatchObject({ roomText: 'Den', key: 'device:relax' });
		expect(by('Relax').copies).toBeUndefined();
	});

	it('shows a Hue scene in several rooms once, opening to each room’s copy', () => {
		const tt = by('Tropical twilight');
		expect(tt.key).toBe('hue:Tropical twilight');
		expect(tt.roomText).toBe('2 rooms');
		expect(tt.room?.name).toBe('Family Room');
		expect(tt.detail).toBe('Family Room, Office');
		expect(tt.active).toBe(true);
		expect(tt.onHome).toBe(true);
		expect(tt.refs).toEqual(['device:tt2', 'device:tt1']);
		expect(tt.copies?.map((c) => [c.roomText, c.href, c.onHome])).toEqual([
			['Family Room', '/settings/devices/tt2', false],
			['Office', '/settings/devices/tt1', true]
		]);
	});

	it('says how many more rooms past two', () => {
		const many = {
			a: hue('a', 'Bright', 'office', 'Office'),
			b: hue('b', 'Bright', 'family_room', 'Family Room'),
			c: hue('c', 'Bright', 'den', 'Den'),
			d: hue('d', 'Bright', '', 'Upstairs', {
				attributes: { kind: 'hue_scene', group_name: 'Upstairs', group_kind: 'zone' }
			})
		};
		const [r] = sceneRows(many, [], rooms);
		expect(r!.roomText).toBe('4 rooms');
		expect(r!.detail).toBe('Den, Family Room +2');
		expect(r!.noRoom).toBe(true);
	});

	it('groups only Hue scenes with the same name', () => {
		const two = {
			a: dev('a', { name: 'Bright', plugin_id: 'plugin.lutron' }),
			b: dev('b', { name: 'Bright', plugin_id: 'plugin.lutron' })
		};
		expect(sceneRows(two, [], rooms)).toHaveLength(2);
	});
});

describe('filters', () => {
	const rows = sceneRows(devices, scenes, rooms, ['device:away', 'scene:eve']);
	const names = (rs: { name: string }[]) => rs.map((r) => r.name);

	it('counts rows as shown', () => {
		expect(sceneCounts(rows, { from: '', query: '' })).toEqual({
			all: 6,
			home: 2,
			active: 2,
			noroom: 3
		});
	});

	it('filters by chip, provider and words', () => {
		expect(names(shownScenes(rows, { chip: 'active', from: '', query: '' }))).toEqual([
			'Deck On',
			'Tropical twilight'
		]);
		expect(names(shownScenes(rows, { chip: 'all', from: 'core', query: '' }))).toEqual(['Evening']);
		expect(names(shownScenes(rows, { chip: 'all', from: '', query: 'phantom' }))).toEqual([
			'Away Scene'
		]);
		// A copy's room finds its group.
		expect(names(shownScenes(rows, { chip: 'all', from: '', query: 'office' }))).toEqual([
			'Tropical twilight'
		]);
	});

	it('lists providers, homeCore first', () => {
		expect(providers(rows).map((p) => `${p.label} ${p.count}`)).toEqual([
			'homeCore 1',
			'Hue 2',
			'Lutron 2',
			'Caséta 1'
		]);
	});
});

describe('sortScenes', () => {
	const rows = sceneRows(devices, scenes, rooms, ['device:sol']);
	const names = (rs: { name: string }[]) => rs.map((r) => r.name);

	it('sorts by room, no room last, a group by its first copy', () => {
		expect(names(sortScenes(rows, 'room'))).toEqual([
			'Deck On',
			'Relax',
			'Tropical twilight',
			'Away Scene',
			'Evening',
			'Solstice'
		]);
	});

	it('sorts by what it is now and by being on Home, either way', () => {
		expect(names(sortScenes(rows, 'now')).slice(0, 2)).toEqual(['Deck On', 'Tropical twilight']);
		expect(names(sortScenes(rows, 'now')).at(-1)).toBe('Evening');
		expect(names(sortScenes(rows, 'home'))[0]).toBe('Solstice');
		expect(names(sortScenes(rows, 'name', true))[0]).toBe('Tropical twilight');
	});

	it('sorts by provider, then its detail in number order', () => {
		const lut = {
			a: dev('a', { name: 'A', plugin_id: 'plugin.lutron', attributes: { phantom_button: 10 } }),
			b: dev('b', { name: 'B', plugin_id: 'plugin.lutron', attributes: { phantom_button: 9 } })
		};
		expect(names(sortScenes(sceneRows(lut, [], rooms), 'from'))).toEqual(['B', 'A']);
	});
});

describe('last run', () => {
	const NOW = Date.parse('2026-11-14T20:00:00');
	it('is a change homeCore knows the cause of, never a plugin’s report at its start', () => {
		const at = '2026-11-14T18:02:00';
		expect(lastRunOf(dev('a', { last_change: { changed_at: at, kind: 'physical' } }))).toBe(
			Date.parse(at)
		);
		expect(lastRunOf(dev('a', { last_change: { changed_at: at, kind: 'unknown' } }))).toBe(
			undefined
		);
		expect(lastRunOf(dev('a', {}))).toBe(undefined);
	});
	it('reads as a moment lately, else how long ago', () => {
		expect(lastRunText(undefined, NOW)).toBe('');
		expect(lastRunText(Date.parse('2026-11-14T18:02:00'), NOW)).toMatch(/^Today, /);
		expect(lastRunText(Date.parse('2026-11-10T18:02:00'), NOW)).toBe('4 d ago');
	});
	it('takes a group’s latest copy', () => {
		const two = {
			a: hue('a', 'Bright', 'office', 'Office', {
				last_change: { changed_at: '2026-11-14T10:00:00Z', kind: 'homecore' }
			}),
			b: hue('b', 'Bright', 'den', 'Den', {
				last_change: { changed_at: '2026-11-14T12:00:00Z', kind: 'homecore' }
			})
		};
		expect(sceneRows(two, [], rooms)[0]!.lastRun).toBe(Date.parse('2026-11-14T12:00:00Z'));
	});
});

describe('withRefs', () => {
	it('adds to the end once, and takes away', () => {
		expect(withRefs(['a', 'b'], ['c', 'a'], true)).toEqual(['a', 'b', 'c']);
		expect(withRefs(['a', 'b', 'c'], ['a', 'c'], false)).toEqual(['b']);
	});
});

describe('pickable', () => {
	const picks = pickable(devices, scenes, rooms);
	it('offers every scene, each Hue room’s copy on its own', () => {
		expect(picks.map((p) => `${p.name} · ${p.label}`)).toEqual([
			'Away Scene · Lutron · Phantom button 80',
			'Deck On · Lutron · Den',
			'Evening · homeCore · 2 devices',
			'Relax · Hue · Den',
			'Solstice · Caséta',
			'Tropical twilight · Hue · Family Room',
			'Tropical twilight · Hue · Office'
		]);
		expect(picks.find((p) => p.name === 'Evening')!.ref).toBe('scene:eve');
	});
	it('finds by name and label', () => {
		expect(findPicks(picks, 'hue office').map((p) => p.ref)).toEqual(['device:tt1']);
		expect(findPicks(picks, '')).toHaveLength(7);
	});
});
