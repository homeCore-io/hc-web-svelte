import { describe, expect, it } from 'vitest';
import { HOUSE, ROOMS, FIXTURE_NOW } from './fixtures/house.js';
import { roomFromCore } from './house.js';
import type { Devices } from './devices.js';
import { gone, type Change } from './layers.js';
import {
	applyPage,
	drawn,
	homePage,
	presentRefs,
	roomPage,
	sectionRef,
	type Card,
	type HomeInput,
	type Page
} from './page.js';

const rooms = ROOMS.map(roomFromCore);
const devices: Devices = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
const home = (over: Partial<HomeInput> = {}): Page =>
	homePage({
		devices,
		rooms,
		scenes: [{ id: 'evening', name: 'Evening' }],
		favourites: [],
		added: [],
		pluginCard: () => undefined,
		alerts: 0,
		chips: [],
		mode: null,
		...over
	});
const ids = (p: Page) => p.sections.map((s) => s.id);
const refs = (cards: Card[]) => cards.map((c) => c.ref);
const section = (p: Page, id: string) => p.sections.find((s) => s.id === id)!;
/** What a section shows, in order, with the layers on. */
const shown = (p: Page, id: string, changes: Change[] = [], mine: Change[] = []) =>
	applyPage(p, changes, mine)
		.sections.find((s) => s.section.id === id)!
		.groups.flatMap((g) => refs(g.shown));

describe('Home, generated (D1)', () => {
	it('has its sections in a fixed order, alerts first', () => {
		expect(ids(home())).toEqual(['alerts', 'chips', 'pinned', 'favourites', 'scenes', 'rooms']);
		expect(section(home(), 'alerts').fixed).toBe(true);
	});

	it('shows alerts only when there are some, and not while editing', () => {
		expect(section(home(), 'alerts').cards).toEqual([]);
		expect(refs(section(home({ alerts: 2 }), 'alerts').cards)).toEqual(['piece:alerts/home']);
		expect(section(home({ alerts: 2, mode: 'edit' }), 'alerts').cards).toEqual([]);
	});

	it('lists scenes in no room — homeCore’s and plugins’ — by name, with the modes above', () => {
		const s = section(home(), 'scenes');
		expect(refs(s.cards)).toEqual(['scene:evening', 'device:caseta_scene_goodnight']);
		expect(s.lead?.kind).toBe('modes');
	});

	it('lists every room with something in it, and none that is empty', () => {
		const r = refs(section(home(), 'rooms').cards);
		expect(r).toContain('room:r-den');
		expect(r).not.toContain('room:r-none');
		expect(r).not.toContain('room:none');
	});

	it('puts devices in no room last, under "Not in a room" — but not modes or scenes', () => {
		const stray = { ...HOUSE[0]!, device_id: 'stray', area: undefined };
		const r = refs(section(home({ devices: { ...devices, stray } }), 'rooms').cards);
		expect(r.at(-1)).toBe('room:none');
	});

	it('pins what the household added, keeping a plugin’s card whose plugin is away', () => {
		const p = home({ added: ['device:hue_lamp', 'card:plugin.wled/wled-card/1', 'device:gone'] });
		const pinned = section(p, 'pinned').cards;
		expect(refs(pinned)).toEqual(['device:hue_lamp', 'card:plugin.wled/wled-card/1']);
		expect(pinned.every((c) => c.added)).toBe(true);
		expect(pinned[1]).toMatchObject({ kind: 'plugin', label: 'A plugin’s card' });
	});

	it('shows this person’s favourites in their order, dropping what is gone — none while editing', () => {
		const favourites = ['device:hue_ceiling', 'device:gone', 'scene:evening'];
		expect(refs(section(home({ favourites }), 'favourites').cards)).toEqual([
			'device:hue_ceiling',
			'scene:evening'
		]);
		expect(section(home({ favourites, mode: 'edit' }), 'favourites').cards).toEqual([]);
	});
});

describe('a room page, generated (N4)', () => {
	const page = (added: string[] = []) =>
		roomPage('r-den', { devices, rooms, added, pluginCard: () => undefined, now: FIXTURE_NOW });

	it('has things to use, scenes, readings, as before', () => {
		expect(ids(page())).toEqual(['devices:controls', 'devices:scenes', 'devices:sensors']);
		expect(page().cardTools).toBe(true);
	});

	it('makes a media player large unless someone chose otherwise', () => {
		const tv = section(page(), 'devices:controls').cards.find((c) => c.ref === 'device:roku_den');
		expect(tv).toMatchObject({ form: 'large' });
	});

	it('puts what was added under "Also here": devices, then plugins’ cards', () => {
		const p = page(['card:plugin.wled/wled-card/1', 'device:caseta_porch', 'device:hue_lamp']);
		const also = section(p, 'added');
		// The lamp is already in the room, so it isn't added again.
		expect(refs(also.cards)).toEqual(['device:caseta_porch', 'card:plugin.wled/wled-card/1']);
		expect(also.cards.map((c) => c.group)).toEqual(['devices', 'cards']);
	});

	it('is empty for a room with nothing in it', () => {
		expect(
			roomPage('r-nowhere', { devices, rooms, added: [], pluginCard: () => undefined }).sections
		).toEqual([]);
	});
});

describe('the layers over a page (M2, G5)', () => {
	it('reads version 1 changes to cards exactly as before', () => {
		const changes: Change[] = [
			{ op: 'hide', ref: 'room:r-garage' },
			{ op: 'move', ref: 'room:r-office', before: 'room:r-den' },
			{ op: 'rename', ref: 'room:r-office', name: 'Study' },
			{ op: 'form', ref: 'device:hue_lamp', form: 'large' }
		];
		const s = applyPage(home({ added: ['device:hue_lamp'] }), changes).sections;
		const roomsShown = s.find((x) => x.section.id === 'rooms')!.groups[0]!;
		expect(refs(roomsShown.shown)[0]).toBe('room:r-office');
		expect(refs(roomsShown.shown)).not.toContain('room:r-garage');
		expect(roomsShown.name('room:r-office')).toBe('Study');
		expect(s.find((x) => x.section.id === 'pinned')!.groups[0]!.form('device:hue_lamp')).toBe(
			'large'
		);
	});

	it('moves, hides and renames sections', () => {
		const changes: Change[] = [
			{ op: 'move', ref: sectionRef('scenes'), before: sectionRef('pinned') },
			{ op: 'hide', ref: sectionRef('chips') },
			{ op: 'rename', ref: sectionRef('rooms'), name: 'Every room' }
		];
		const s = applyPage(home(), changes).sections;
		expect(s.map((x) => x.section.id)).toEqual([
			'alerts',
			'scenes',
			'pinned',
			'favourites',
			'rooms'
		]);
		expect(s.at(-1)!.title).toBe('Every room');
		expect(s.at(-1)!.renamed).toBe(true);
		// While arranging, the hidden one is offered again, last.
		const arranging = applyPage(home(), changes, [], { arranging: true }).sections;
		expect(arranging.at(-1)).toMatchObject({ hidden: true, section: { id: 'chips' } });
	});

	it('keeps the alerts first — no change moves, hides or renames them (G6)', () => {
		const changes: Change[] = [
			{ op: 'move', ref: sectionRef('alerts'), before: null },
			{ op: 'move', ref: sectionRef('rooms'), before: sectionRef('alerts') },
			{ op: 'hide', ref: sectionRef('alerts') },
			{ op: 'rename', ref: sectionRef('alerts'), name: 'Never mind' }
		];
		const s = applyPage(home({ alerts: 1 }), changes).sections;
		expect(s[0]).toMatchObject({
			section: { id: 'alerts' },
			title: 'Needs attention',
			hidden: false
		});
		expect(s.map((x) => x.section.id)).toEqual([
			'alerts',
			'chips',
			'pinned',
			'favourites',
			'scenes',
			'rooms'
		]);
	});

	it('sizes favourites by the person’s own changes only, in their list’s order', () => {
		const p = home({ favourites: ['device:hue_ceiling', 'device:hue_lamp'] });
		const house: Change[] = [
			{ op: 'form', ref: 'device:hue_ceiling', form: 'compact' },
			{ op: 'move', ref: 'device:hue_lamp', before: 'device:hue_ceiling' }
		];
		const mine: Change[] = [{ op: 'form', ref: 'device:hue_lamp', form: 'large' }];
		const fav = applyPage(p, house, mine).sections.find((s) => s.section.id === 'favourites')!;
		expect(refs(fav.groups[0]!.shown)).toEqual(['device:hue_ceiling', 'device:hue_lamp']);
		expect(fav.groups[0]!.form('device:hue_ceiling')).toBeUndefined();
		expect(fav.groups[0]!.form('device:hue_lamp')).toBe('large');
	});

	it('moves a card into another section, and before a card there (G5)', () => {
		const p = home({ added: ['device:hue_lamp'] });
		const changes: Change[] = [
			{ op: 'move', ref: 'scene:evening', before: 'device:hue_lamp', into: 'pinned' }
		];
		expect(shown(p, 'pinned', changes)).toEqual(['scene:evening', 'device:hue_lamp']);
		expect(shown(p, 'scenes', changes)).toEqual(['device:caseta_scene_goodnight']);
	});

	it('ignores a move into a section the page doesn’t have', () => {
		const changes: Change[] = [{ op: 'move', ref: 'scene:evening', before: null, into: 'nowhere' }];
		expect(shown(home(), 'scenes', changes)).toEqual([
			'scene:evening',
			'device:caseta_scene_goodnight'
		]);
	});

	it('orders "Also here" within its devices and within its plugins’ cards, as before', () => {
		const p = roomPage('r-den', {
			devices,
			rooms,
			added: ['device:caseta_porch', 'device:shelly_heater', 'card:plugin.wled/wled-card/1'],
			pluginCard: () => undefined
		});
		const changes: Change[] = [{ op: 'move', ref: 'device:caseta_porch', before: null }];
		const groups = applyPage(p, changes).sections.find((s) => s.section.id === 'added')!.groups;
		expect(groups.map((g) => refs(g.shown))).toEqual([
			['device:shelly_heater', 'device:caseta_porch'],
			['card:plugin.wled/wled-card/1']
		]);
	});
});

describe('what a page names, and draws', () => {
	it('names its sections and cards, so Done keeps changes to them (EditBar)', () => {
		const present = presentRefs(home({ added: ['device:hue_lamp'] }));
		expect(present.has(sectionRef('rooms'))).toBe(true);
		expect(present.has(sectionRef('alerts'))).toBe(true);
		expect(present.has('device:hue_lamp')).toBe(true);
		expect(present.has('room:r-den')).toBe(true);
		expect(present.has('scene:evening')).toBe(true);
	});

	it('draws a section with cards, or always if it says so, or — arranging — if it can be found again', () => {
		const at = (p: Page, id: string, arranging: boolean, changes: Change[] = []) =>
			drawn(
				applyPage(p, changes, [], { arranging }).sections.find((s) => s.section.id === id)!,
				arranging
			);
		expect(at(home(), 'pinned', false)).toBe(false);
		expect(at(home(), 'pinned', true)).toBe(false);
		expect(at(home({ mode: 'edit' }), 'pinned', true)).toBe(true);
		expect(at(home(), 'favourites', true)).toBe(true);
		expect(at(home(), 'rooms', false)).toBe(true);
		const hidden: Change[] = [{ op: 'hide', ref: sectionRef('rooms') }];
		expect(at(home(), 'rooms', true, hidden)).toBe(true);
	});
});

describe("Edit's Done keeps what the page still has (EditBar)", () => {
	it('keeps changes to sections, and drops those to things that are gone', () => {
		const changes: Change[] = [
			{ op: 'move', ref: sectionRef('scenes'), before: sectionRef('pinned') },
			{ op: 'hide', ref: sectionRef('chips') },
			{ op: 'rename', ref: sectionRef('rooms'), name: 'Every room' },
			{ op: 'hide', ref: 'room:r-den' },
			{ op: 'hide', ref: 'room:r-demolished' },
			{ op: 'move', ref: sectionRef('long-gone'), before: null }
		];
		expect(gone(changes, presentRefs(home()))).toEqual([changes[4], changes[5]]);
	});
});

describe('a section’s layout (G3)', () => {
	const layoutOf = (changes: Change[]) =>
		applyPage(home(), changes).sections.find((s) => s.section.id === 'rooms')!.layout;

	it('is its own until it is given one it may take', () => {
		expect(layoutOf([])).toBe('list');
		expect(layoutOf([{ op: 'config', ref: 'section:rooms', config: { layout: 'field' } }])).toBe(
			'field'
		);
		expect(layoutOf([{ op: 'config', ref: 'section:rooms', config: { layout: 'row' } }])).toBe(
			'list'
		);
	});

	it('the person’s choice over the household’s', () => {
		const house: Change = { op: 'config', ref: 'section:rooms', config: { layout: 'tiles' } };
		const mine: Change = { op: 'config', ref: 'section:rooms', config: { layout: 'list' } };
		expect(layoutOf([house, mine])).toBe('list');
	});
});
