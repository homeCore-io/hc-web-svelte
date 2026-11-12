import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import {
	arrangeTabs,
	blocksOf,
	flipped,
	layoutOf,
	nudged,
	ordered,
	resolve,
	roomIn,
	tabToShow,
	withoutRoom,
	withRoomLayout,
	withRoomStars
} from './layout.js';
import { consoleRoom, type TabId } from './room.js';

const tabs = (...ids: TabId[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe('a room’s layout, read from a document', () => {
	it('keeps what it knows and leaves out the rest', () => {
		expect(
			layoutOf({
				favs: ['device:a', 'device:a', 7, ''],
				ownFavs: 'yes',
				tabs: ['media', 'pool', 'lights'],
				hidden: ['sensors'],
				opens: 'garden',
				columns: ['rid:1'],
				off: ['lamp'],
				picture: 'photo',
				pillsOff: ['door']
			})
		).toEqual({
			favs: ['device:a'],
			tabs: ['media', 'lights'],
			hidden: ['sensors'],
			columns: ['rid:1'],
			off: ['lamp'],
			picture: 'photo',
			pillsOff: ['door']
		});
		expect(layoutOf({ picture: 'video' })).toEqual({});
	});

	it('keeps a photo’s spots that have a place, on the photo', () => {
		expect(
			layoutOf({
				spots: [
					{ x: 12.345, y: 50, device: 'lamp', size: 'l' },
					{ x: -4, y: 140, device: '', size: 'xl' },
					{ x: '10', y: 5 },
					'spot'
				]
			})
		).toEqual({
			spots: [
				{ x: 12.3, y: 50, device: 'lamp', size: 'l' },
				{ x: 0, y: 100 }
			]
		});
		// Every spot taken off is a choice, and not the drawing's.
		expect(layoutOf({ spots: [] })).toEqual({ spots: [] });
		expect(
			layoutOf({ spots: Array.from({ length: 40 }, () => ({ x: 1, y: 1 })) }).spots
		).toHaveLength(24);
	});

	it('keeps the devices fixed to a drawing’s spots, none among them', () => {
		expect(layoutOf({ links: { floor: 'lamp', c2: '', 'no such': 'x', tv: 4 } })).toEqual({
			links: { floor: 'lamp', c2: '' }
		});
		expect(layoutOf({ links: {} })).toEqual({});
	});

	it('is empty for anything that isn’t one', () => {
		expect(layoutOf(null)).toEqual({});
		expect(layoutOf([1])).toEqual({});
		expect(roomIn(undefined, 'r')).toEqual({});
		expect(roomIn({ r: { opens: 'media' } }, 'r')).toEqual({ opens: 'media' });
	});

	it('keeps the household choosing no favorites apart from not choosing', () => {
		expect(layoutOf({ favs: [] })).toEqual({ favs: [] });
		expect(layoutOf({})).toEqual({});
	});
});

describe('changing a room’s layout in a layer', () => {
	it('sets and clears one room’s choices, keeping the rest', () => {
		const c = { fader: 'glass' as const, rooms: { den: { opens: 'media' as const } } };
		const next = withRoomLayout(c, 'fam', { hidden: ['sensors'] });
		expect(next).toEqual({
			fader: 'glass',
			rooms: { den: { opens: 'media' }, fam: { hidden: ['sensors'] } }
		});
		expect(withRoomLayout(next, 'fam', { hidden: undefined })).toEqual(c);
	});

	it('leaves nothing when nothing is left', () => {
		expect(withRoomLayout(undefined, 'fam', { opens: undefined })).toBeUndefined();
		expect(withRoomLayout({ rooms: { fam: { off: ['x'] } } }, 'fam', { off: [] })).toBeUndefined();
	});

	it('takes a room back to the layer below', () => {
		const c = { switch: 'keypad' as const, rooms: { fam: { opens: 'media' as const } } };
		expect(withoutRoom(c, 'fam')).toEqual({ switch: 'keypad' });
		expect(withoutRoom({ rooms: { fam: {} } }, 'fam')).toBeUndefined();
	});

	it('changes a photo’s spots as one, beside the picture', () => {
		const c = { rooms: { fam: { picture: 'photo' as const, spots: [{ x: 1, y: 2 }] } } };
		const next = withRoomLayout(c, 'fam', { spots: [{ x: 3, y: 4, device: 'lamp' }] });
		expect(next).toEqual({
			rooms: { fam: { picture: 'photo', spots: [{ x: 3, y: 4, device: 'lamp' }] } }
		});
		expect(withRoomLayout(next, 'fam', { links: { floor: '' } })?.rooms?.fam).toEqual({
			picture: 'photo',
			spots: [{ x: 3, y: 4, device: 'lamp' }],
			links: { floor: '' }
		});
	});
});

describe('the person’s layer over the household’s over the defaults', () => {
	const house = {
		favs: ['device:fan'],
		tabs: ['media' as const],
		opens: 'media' as const,
		picture: 'plain' as const
	};

	it('takes each choice from the person, else the household', () => {
		const r = resolve({ opens: 'climate', off: ['lamp'] }, house, []);
		expect(r.opens).toBe('climate');
		expect(r.tabs).toEqual(['media']);
		expect(r.off).toEqual(['lamp']);
		expect(r.picture).toBe('plain');
	});

	it('falls back to the room’s own with neither', () => {
		expect(resolve({}, {}, [])).toEqual({
			favs: [],
			tabs: undefined,
			hidden: [],
			opens: undefined,
			columns: undefined,
			off: [],
			picture: 'drawn',
			spots: undefined,
			links: {},
			pillsOff: []
		});
	});

	it('shows a person’s stars where the household chose no favorites', () => {
		expect(resolve({}, {}, ['device:lamp']).favs).toEqual(['device:lamp']);
	});

	it('shows the household’s favorites over stars, until the person makes them their own', () => {
		expect(resolve({}, house, ['device:lamp']).favs).toEqual(['device:fan']);
		expect(resolve({ ownFavs: true }, house, ['device:lamp']).favs).toEqual(['device:lamp']);
		expect(resolve({ ownFavs: true }, house, []).favs).toEqual([]);
	});

	it('shows the household’s alone for everyone', () => {
		expect(resolve(undefined, house, ['device:lamp']).favs).toEqual(['device:fan']);
		expect(resolve(undefined, {}, ['device:lamp']).favs).toEqual([]);
	});

	it('keeps the picture, its spots and the pills the household’s', () => {
		const mine = { picture: 'drawn', pillsOff: ['x'], spots: [], links: { a: 'b' } } as never;
		expect(resolve(mine, house).picture).toBe('plain');
		expect(resolve(mine, {}).pillsOff).toEqual([]);
		const photo = { picture: 'photo' as const, spots: [{ x: 5, y: 5 }], links: { c1: 'lamp' } };
		expect(resolve(mine, photo)).toMatchObject(photo);
	});
});

describe('a room’s tabs as its layout has them', () => {
	const all = tabs('lights', 'media', 'climate', 'sensors');

	it('orders them, the ones it doesn’t name after in their own order', () => {
		const a = arrangeTabs(all, { tabs: ['sensors', 'media'], hidden: [] });
		expect(ids(a.shown)).toEqual(['sensors', 'media', 'lights', 'climate']);
		expect(a.opens).toBe('sensors');
	});

	it('hides some and opens on the one starred', () => {
		const a = arrangeTabs(all, { hidden: ['sensors', 'lights'], opens: 'climate' });
		expect(ids(a.shown)).toEqual(['media', 'climate']);
		expect(ids(a.hidden)).toEqual(['lights', 'sensors']);
		expect(a.opens).toBe('climate');
	});

	it('never hides the tab the room opens on', () => {
		const a = arrangeTabs(all, { hidden: ['media'], opens: 'media' });
		expect(ids(a.shown)).toContain('media');
		expect(a.hidden).toEqual([]);
	});

	it('shows every tab rather than none', () => {
		const a = arrangeTabs(tabs('lights', 'media'), { hidden: ['lights', 'media'] });
		expect(ids(a.shown)).toEqual(['lights', 'media']);
	});

	it('opens on the first shown when the starred tab is gone', () => {
		const a = arrangeTabs(all, { hidden: ['lights'], opens: 'doors' });
		expect(a.opens).toBe('media');
	});

	it('shows the tab asked for, else the one it opens on', () => {
		const a = arrangeTabs(all, { hidden: ['sensors'], opens: 'media' });
		expect(tabToShow(a, 'climate')).toBe('climate');
		expect(tabToShow(a, 'sensors')).toBe('media');
		expect(tabToShow(a, null)).toBe('media');
	});
});

const dev = (id: string, kind: string, attributes: Record<string, unknown> = {}): CoreDevice =>
	({
		device_id: id,
		name: id,
		plugin_id: 'plugin.hue',
		device_type: kind,
		available: true,
		attributes
	}) as CoreDevice;

describe('the Lights tab’s columns', () => {
	const room = consoleRoom([
		dev('lamp', 'light', { brightness_pct: 50, room_rid: 'r1', on: true }),
		dev('desk', 'light', { brightness_pct: 50, room_rid: 'r1' }),
		{ ...dev('over', 'light', { brightness_pct: 50 }), plugin_id: 'plugin.lutron' },
		{ ...dev('deck', 'switch', { on: false }), plugin_id: 'plugin.lutron' }
	]);

	it('come in their own order without a layout', () => {
		expect(blocksOf(room.lights).map((b) => b.key)).toEqual([
			'rid:r1',
			'plugin:plugin.lutron',
			'switches'
		]);
	});

	it('come in the layout’s order', () => {
		expect(blocksOf(room.lights, ['switches', 'plugin:plugin.lutron']).map((b) => b.key)).toEqual([
			'switches',
			'plugin:plugin.lutron',
			'rid:r1'
		]);
	});

	it('leave out lights and switches hidden from the room', () => {
		const hid = consoleRoom(
			[
				dev('lamp', 'light', { brightness_pct: 50, room_rid: 'r1' }),
				dev('desk', 'light', { brightness_pct: 50, room_rid: 'r1' }),
				dev('deck', 'switch', { on: false })
			],
			undefined,
			{},
			new Set(['desk', 'deck'])
		);
		expect(hid.lights.columns[0]!.lights.map((d) => d.device_id)).toEqual(['lamp']);
		expect(hid.lights.switches).toEqual([]);
		expect(hid.tabs.find((t) => t.id === 'lights')?.count).toBe(1);
	});
});

describe('arranging', () => {
	it('moves an item a place either way, and not past the ends', () => {
		expect(nudged(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
		expect(nudged(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
		expect(nudged(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
		expect(nudged(['a', 'b'], 'z', 1)).toEqual(['a', 'b']);
	});

	it('flips an item in or out', () => {
		expect(flipped(['a'], 'b')).toEqual(['a', 'b']);
		expect(flipped(['a', 'b'], 'a')).toEqual(['b']);
	});

	it('orders by a list, keeping the rest stable', () => {
		expect(ordered(['a', 'b', 'c', 'd'], (x) => x, ['c', 'zz', 'a'])).toEqual(['c', 'a', 'b', 'd']);
	});

	it('puts a room’s stars in order without moving the others on Home', () => {
		const room = new Set(['device:a', 'device:b', 'device:c']);
		expect(
			withRoomStars(['scene:x', 'device:a', 'device:y', 'device:b'], room, [
				'device:b',
				'device:a',
				'device:c'
			])
		).toEqual(['scene:x', 'device:b', 'device:y', 'device:a', 'device:c']);
		expect(withRoomStars(['device:a', 'scene:x', 'device:b'], room, ['device:b'])).toEqual([
			'device:b',
			'scene:x'
		]);
	});
});
