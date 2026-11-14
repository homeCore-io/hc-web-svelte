import { describe, expect, it } from 'vitest';
import type { CoreDevice, Devices, Schema } from '../devices.js';
import type { Room } from '../house.js';
import {
	agoWord,
	allEvents,
	areasOf,
	badgeOf,
	camerasOf,
	camerasWord,
	camOf,
	cardsAcross,
	eventsOf,
	eventsWord,
	gridOf,
	pageOf,
	pickedOf,
	pillPrefsOf,
	pillsOf,
	pillWord,
	railOf,
	railWidth,
	roomLayoutOf,
	seesNow,
	stillAt,
	stillKept,
	wallSplit,
	withHousePills,
	withPillPrefs,
	type CamEvent,
	type PillPrefs
} from './cameras.js';

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	extra: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	available: true,
	attributes,
	plugin_id: 'plugin.reolink',
	...extra
});
const ptz: Schema = {
	attributes: {},
	actions: [
		{ id: 'take_snapshot', label: 'Take a snapshot' },
		{ id: 'ptz_move', label: 'Turn' },
		{
			id: 'goto_preset',
			label: 'Go to a preset',
			params: [
				{
					name: 'preset',
					kind: 'int',
					options: [
						{ value: '0', label: 'Door' },
						{ value: '1', label: 'Yard' }
					]
				}
			]
		}
	]
} as unknown as Schema;
const room = (id: string, name: string): Room => ({
	id,
	name,
	slug: name.toLowerCase(),
	aliases: [],
	deviceIds: []
});

describe('a camera device', () => {
	const deck = dev(
		'reolink_deck',
		'camera',
		{
			stream: 'reolink_deck',
			stream_hd: 'reolink_deck_hd',
			snapshot: 'snap/reolink_deck-1.jpg',
			person_detected: false,
			vehicle_detected: true,
			model: 'E1 Outdoor SE'
		},
		{ name: 'Front Deck', schema: ptz }
	);
	const all: Devices = {
		reolink_deck: deck,
		reolink_deck_spotlight: dev('reolink_deck_spotlight', 'light', { on: false }),
		reolink_deck_siren: dev('reolink_deck_siren', 'siren', { on: false })
	};

	it('has its streams, still, kinds, turning and positions, spotlight and siren', () => {
		const c = camOf(deck, all);
		expect(c).toMatchObject({
			name: 'Front Deck',
			stream: 'reolink_deck',
			hd: 'reolink_deck_hd',
			snapshot: 'snap/reolink_deck-1.jpg',
			model: 'E1 Outdoor SE',
			kinds: ['person', 'vehicle'],
			ptz: true,
			presets: [
				{ value: 0, label: 'Door' },
				{ value: 1, label: 'Yard' }
			]
		});
		expect(c.spotlight?.device_id).toBe('reolink_deck_spotlight');
		expect(c.siren?.device_id).toBe('reolink_deck_siren');
		expect(seesNow(c)).toBe('vehicle');
	});

	it('is only the cameras, by name, and a camera without turning has no pad', () => {
		const list = camerasOf(
			[
				dev('b', 'camera', {}, { name: 'Porch' }),
				dev('a', 'doorbell', {}, { name: 'Door' }),
				dev('a_spotlight', 'light')
			],
			{}
		);
		expect(list.map((c) => c.name)).toEqual(['Door', 'Porch']);
		expect(list[0]!.ptz).toBe(false);
		expect(list[0]!.presets).toEqual([]);
	});
});

describe('laying out the Cameras page', () => {
	it('has one column of snapshots up to four, two to eight, and chips from nine', () => {
		expect(railOf(1)).toEqual({ cols: 1, chips: false });
		expect(railOf(4)).toEqual({ cols: 1, chips: false });
		expect(railOf(5)).toEqual({ cols: 2, chips: false });
		expect(railOf(8)).toEqual({ cols: 2, chips: false });
		expect(railOf(9)).toEqual({ cols: 2, chips: true });
	});

	it('lays the grid square-ish', () => {
		expect(gridOf(1)).toEqual({ cols: 1, rows: 1 });
		expect(gridOf(4)).toEqual({ cols: 2, rows: 2 });
		expect(gridOf(6)).toEqual({ cols: 3, rows: 2 });
		expect(gridOf(10)).toEqual({ cols: 4, rows: 3 });
	});

	it('makes the rail as wide as its snapshots fit down it', () => {
		// Four down 400 px with 10 px gaps: 92.5 px tall, so 164 wide.
		expect(railWidth(400, 4, 1, { gap: 10 })).toBe(164);
		// Never past the most, nor under the least.
		expect(railWidth(2000, 2, 1)).toBe(250);
		expect(railWidth(100, 8, 2)).toBe(150);
	});

	it('gives the view what its height allows and the rail the rest it can use', () => {
		const s = wallSplit(982, 314, 414, 6, 2, { above: 26 });
		expect(s.viewer).toBe(558);
		expect(s.viewer + 16 + s.rail).toBeLessThanOrEqual(982);
		expect(s.rail).toBe(407);
		// A tall window: the view as wide as it may be, the rail what's left.
		const t = wallSplit(1000, 900, 900, 3, 1);
		expect(t.viewer).toBe(1000 - 150 - 16);
		expect(t.rail).toBe(150);
	});

	it('names the areas by room, All first and no room last', () => {
		const rooms = [room('r1', 'Garage'), room('r2', 'Outside')];
		const cams = camerasOf(
			[
				dev('a', 'camera', {}, { area: 'outside' }),
				dev('b', 'camera', {}, { area: 'garage' }),
				dev('c', 'camera', {}, { area: 'outside' }),
				dev('d', 'camera')
			],
			{}
		);
		expect(areasOf(cams, rooms).map((a) => [a.name, a.n])).toEqual([
			['All', 4],
			['Garage', 1],
			['Outside', 2],
			['Elsewhere', 1]
		]);
	});
});

describe('a room’s Cameras tab', () => {
	it('fills the tab with one camera and rolls the rest from two', () => {
		expect(roomLayoutOf(0)).toBe('none');
		expect(roomLayoutOf(1)).toBe('one');
		expect(roomLayoutOf(2)).toBe('roll');
		expect(roomLayoutOf(5)).toBe('roll');
	});

	it('shows the camera picked while it’s here, else the first', () => {
		const cams = camerasOf([dev('a', 'camera'), dev('b', 'camera')], {});
		expect(pickedOf(cams, 'b')?.id).toBe('b');
		expect(pickedOf(cams, 'gone')?.id).toBe('a');
		expect(pickedOf([], 'a')).toBeUndefined();
	});
});

describe('the day’s events', () => {
	const t = (s: string) => `2026-11-11T20:${s}Z`;
	it('starts one each time a kind turns on, joining sightings close together', () => {
		const events = eventsOf('cam', {
			kinds: {
				person: [
					{ at: t('00:00'), value: true },
					{ at: t('00:10'), value: false },
					{ at: t('00:30'), value: true },
					{ at: t('00:40'), value: false },
					{ at: t('05:00'), value: true },
					{ at: t('05:20'), value: false }
				],
				vehicle: [
					{ at: t('02:00'), value: false },
					{ at: t('03:00'), value: true }
				]
			},
			snapshots: [
				{ at: t('00:01'), value: 'snap/cam-1.jpg' },
				{ at: t('03:02'), value: 'snap/cam-2.jpg' },
				{ at: t('09:00'), value: 'snap/cam-3.jpg' }
			]
		});
		expect(events.map((e) => [e.kind, new Date(e.at).toISOString(), e.snapshot])).toEqual([
			['person', '2026-11-11T20:05:00.000Z', undefined],
			['vehicle', '2026-11-11T20:03:00.000Z', 'snap/cam-2.jpg'],
			['person', '2026-11-11T20:00:00.000Z', 'snap/cam-1.jpg']
		]);
		expect(events[2]!.end).toBe(Date.parse(t('00:40')));
		expect(events[1]!.end).toBeUndefined();
		expect(events[0]!.key).toBe(`cam:person:${Date.parse(t('05:00'))}`);
	});

	it('merges cameras newest first, kept to the kinds asked for', () => {
		const e = (cam: string, kind: CamEvent['kind'], at: number): CamEvent => ({
			key: `${cam}:${kind}:${at}`,
			cam,
			kind,
			at
		});
		const by = { a: [e('a', 'person', 3), e('a', 'animal', 1)], b: [e('b', 'vehicle', 2)] };
		expect(allEvents(by).map((x) => x.at)).toEqual([3, 2, 1]);
		expect(allEvents(by, ['b']).map((x) => x.cam)).toEqual(['b']);
		expect(allEvents(by, undefined, ['animal']).map((x) => x.kind)).toEqual(['animal']);
	});

	it('says how long ago', () => {
		const now = 10_000_000;
		expect(agoWord(now - 20_000, now)).toBe('now');
		expect(agoWord(now - 4 * 60_000, now)).toBe('4 min ago');
		expect(agoWord(now - 130 * 60_000, now)).toBe('2 h ago');
		expect(badgeOf({ key: 'k', cam: 'c', kind: 'person', at: now - 4 * 60_000 }, now)).toBe(
			'Person 4m'
		);
	});
});

describe('the header’s pills', () => {
	const now = 100 * 60_000;
	const e = (cam: string, kind: CamEvent['kind'], mins: number): CamEvent => ({
		key: `${cam}:${kind}:${mins}`,
		cam,
		kind,
		at: now - mins * 60_000
	});

	it('are a person, a vehicle or a package unless the house chose', () => {
		expect(pillPrefsOf(undefined)).toEqual({
			kinds: ['person', 'vehicle', 'package'],
			home: false,
			off: []
		});
		expect(pillPrefsOf({ kinds: ['animal', 'nope' as never], home: true, off: ['r1'] })).toEqual({
			kinds: ['animal'],
			home: true,
			off: ['r1']
		});
	});

	it('are the newest of each kind at each camera in the last half hour', () => {
		const list = [
			e('a', 'person', 4),
			e('a', 'person', 8),
			e('a', 'animal', 2),
			e('b', 'person', 12),
			e('a', 'vehicle', 45)
		];
		const kinds = pillPrefsOf(undefined).kinds;
		expect(pillsOf(list, now, kinds).map((x) => x.key)).toEqual(['a:person:4', 'b:person:12']);
		expect(pillsOf(list, now, ['person', 'animal'], { most: 2 }).map((x) => x.key)).toEqual([
			'a:animal:2',
			'a:person:4'
		]);
	});

	it('say what, where when there are several, and when', () => {
		expect(pillWord(e('a', 'person', 4), now)).toBe('Person · 4 min ago');
		expect(pillWord(e('a', 'package', 0), now, 'Porch')).toBe('Package · Porch · now');
	});

	it('keep only what differs from the default', () => {
		expect(withPillPrefs(undefined, { kinds: ['package', 'person', 'vehicle'] })).toBeUndefined();
		expect(withPillPrefs(undefined, { home: true, off: ['b', 'a', 'a'] })).toEqual({
			home: true,
			off: ['a', 'b']
		});
		expect(withPillPrefs({ home: true }, { home: false })).toBeUndefined();
		expect(withPillPrefs(undefined, { kinds: ['animal', 'person'] })).toEqual({
			kinds: ['person', 'animal']
		});
	});

	it('leave the household’s other console choices alone', () => {
		const house: { fader?: string; pills?: PillPrefs } = { fader: 'glass' };
		expect(withHousePills(house, { home: true })).toEqual({
			fader: 'glass',
			pills: { home: true }
		});
		expect(withHousePills({ pills: { home: true } }, { home: false })).toBeUndefined();
	});
});

describe('paging the events', () => {
	it('shows as many as fit and says which', () => {
		expect(pageOf(110, 7, 0)).toEqual({
			first: 0,
			last: 7,
			prev: undefined,
			next: 7,
			word: '1 to 7 of 110'
		});
		expect(pageOf(110, 7, 7)).toMatchObject({ first: 7, last: 14, prev: 0, next: 14 });
		expect(pageOf(110, 7, 105)).toMatchObject({
			first: 105,
			last: 110,
			prev: 98,
			next: undefined,
			word: '106 to 110 of 110'
		});
	});

	it('says nothing when all fit, and keeps pages whole as the room changes', () => {
		expect(pageOf(5, 7, 0)).toEqual({
			first: 0,
			last: 5,
			prev: undefined,
			next: undefined,
			word: ''
		});
		expect(pageOf(0, 7, 14)).toMatchObject({ first: 0, last: 0, word: '' });
		// Past the end (events aged out, or a filter): the last page.
		expect(pageOf(20, 7, 70)).toMatchObject({ first: 14, last: 20 });
		// From the middle of a page, its start.
		expect(pageOf(20, 6, 8)).toMatchObject({ first: 6, last: 12 });
		expect(pageOf(3, 0, 0)).toMatchObject({ first: 0, last: 1, next: 1 });
	});

	it('fits cards across', () => {
		expect(cardsAcross(1000, 130, 10)).toBe(7);
		expect(cardsAcross(1130, 130, 10)).toBe(8);
		expect(cardsAcross(50, 130, 10)).toBe(1);
	});
});

describe('counts while they load', () => {
	it('never says 0 cameras or 0 events before they are read', () => {
		expect(camerasWord(0, false)).toBe('Loading cameras…');
		expect(camerasWord(6, true)).toBe('6 cameras');
		expect(camerasWord(1, true)).toBe('1 camera');
		expect(eventsWord(0, true)).toBe('Reading…');
		expect(eventsWord(3, true)).toBe('3 events so far');
		expect(eventsWord(0, false)).toBe('0 events');
		expect(eventsWord(1, false)).toBe('1 event');
	});
});

describe('stills the plugin still keeps', () => {
	const snap = (n: number) => `snap/cam-${1794584940000 + n * 1000}.jpg`;
	const day = Array.from({ length: 25 }, (_, i) => snap(i));

	it('reads when a still was taken from its name', () => {
		expect(stillAt('snap/reolink_driveway-1794584940106.jpg')).toBe(1794584940106);
		expect(stillAt('snap/other.jpg')).toBeUndefined();
	});

	it('keeps only the newest of the day, as the plugin deletes its oldest', () => {
		expect(stillKept(snap(24), day)).toBe(true);
		expect(stillKept(snap(5), day)).toBe(true);
		expect(stillKept(snap(4), day)).toBe(false);
		expect(stillKept(snap(0), day)).toBe(false);
		expect(stillKept(snap(4), day, undefined, 25)).toBe(true);
	});

	it('takes a still not in the day yet as kept, and none at or before one found gone', () => {
		expect(stillKept(snap(30), day)).toBe(true);
		expect(stillKept(snap(10), day, 1794584940000 + 12_000)).toBe(false);
		expect(stillKept(snap(12), day, 1794584940000 + 12_000)).toBe(false);
		expect(stillKept(snap(13), day, 1794584940000 + 12_000)).toBe(true);
	});
});
