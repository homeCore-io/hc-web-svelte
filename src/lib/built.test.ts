import { describe, expect, it } from 'vitest';
import { HOUSE, ROOMS } from './fixtures/house.js';
import { roomFromCore } from './house.js';
import type { CoreDevice, Devices } from './devices.js';
import { barOf, houseBar, type Change, type HouseDoc, type PersonDoc } from './layers.js';
import { applyPage, builtPage, homePage, roomPage, withOwn, type Page } from './page.js';
import { tabsFor, allowedOn } from './display.js';
import { barFor, pageKey } from './nav.js';
import {
	copyOf,
	displayPages,
	findPage,
	listPages,
	mayMake,
	withPage,
	withPageInBar,
	withPageNamed,
	withPageOnDisplay,
	withoutPage
} from './built.js';

const rooms = ROOMS.map(roomFromCore);
const devices: Devices = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
/** Home as computed for these changes: what they added is on it. */
const home = (changes: Change[] = []): Page =>
	homePage({
		devices,
		rooms,
		scenes: [{ id: 'evening', name: 'Evening' }],
		favourites: [],
		added: changes.flatMap((c) => (c.op === 'add' ? [c.ref] : [])),
		pluginCard: () => undefined,
		alerts: 0,
		chips: [],
		mode: null
	});
/** A page someone made, drawn from its changes, as section titles and refs. */
const drawnBuilt = (changes: Change[], d: Devices = devices) => {
	const added = changes.flatMap((c) => (c.op === 'add' ? [c.ref] : []));
	const page = builtPage('p1', {
		devices: d,
		rooms,
		scenes: [{ id: 'evening', name: 'Evening' }],
		added,
		pluginCard: () => undefined
	});
	return applyPage(withOwn(page, changes), changes)
		.sections.map((s) => ({
			title: s.title,
			layout: s.layout,
			refs: s.groups.flatMap((g) => g.shown.map((c) => c.ref))
		}))
		.filter((s) => s.refs.length > 0);
};

const house: HouseDoc = {
	version: 3,
	built: [{ id: 'kitchen', name: 'Kitchen panel', icon: 'kitchen' }],
	pages: {
		'page:kitchen': [
			{ op: 'section', ref: 'section:own-a', title: 'Lights', layout: 'grid' },
			{ op: 'add', ref: 'device:hue_lamp', into: 'own-a' },
			{ op: 'add', ref: 'scene:evening', into: 'own-a' }
		]
	}
};
const person: PersonDoc = { version: 1, built: [{ id: 'movie', name: 'Movie night' }] };

describe('pages people make (G27, G28)', () => {
	it('lists the house’s pages, then the person’s own, with whose and how many cards', () => {
		expect(listPages(house, person)).toEqual([
			{ id: 'kitchen', name: 'Kitchen panel', icon: 'kitchen', whose: 'house', cards: 2 },
			{ id: 'movie', name: 'Movie night', whose: 'mine', cards: 0 }
		]);
		expect(findPage('movie', house, person)?.whose).toBe('mine');
		expect(findPage('gone', house, person)).toBeUndefined();
	});

	it('an empty page holds nothing until something is added', () => {
		const doc = withPage(person, { id: 'garden', name: 'Garden' });
		expect(doc.pages?.['page:garden']).toEqual([]);
		expect(drawnBuilt([])).toEqual([]);
	});

	it('draws what its layer added, in the sections it made; rooms too', () => {
		expect(
			drawnBuilt([
				...house.pages!['page:kitchen']!,
				{ op: 'add', ref: 'room:r-den' },
				{ op: 'add', ref: 'device:gone' }
			])
		).toEqual([
			{ title: 'Cards', layout: 'grid', refs: ['room:r-den'] },
			{ title: 'Lights', layout: 'grid', refs: ['device:hue_lamp', 'scene:evening'] }
		]);
	});

	it('renames, gives a symbol, and removes a page with its changes', () => {
		expect(withPageNamed(house, 'kitchen', { name: 'Kitchen', icon: 'sun' }).built).toEqual([
			{ id: 'kitchen', name: 'Kitchen', icon: 'sun' }
		]);
		const gone = withoutPage(house, 'kitchen');
		expect(gone.built).toEqual([]);
		expect(gone.pages?.['page:kitchen']).toBeUndefined();
	});

	it('only people who may edit the house’s pages make the house’s; anyone their own', () => {
		expect(mayMake('house', false)).toBe(false);
		expect(mayMake('house', true)).toBe(true);
		expect(mayMake('mine', false)).toBe(true);
	});

	it('is arranged at page:<id>', () => {
		expect(pageKey('/pages/kitchen')).toBe('page:kitchen');
		expect(pageKey('/pages')).toBeNull();
	});
});

describe('a copy is a snapshot (G29)', () => {
	it('copies Home’s sections and cards, with their names and sizes, but not the house’s pieces', () => {
		const shared: Change[] = [
			{ op: 'add', ref: 'device:hue_lamp' },
			{ op: 'form', ref: 'device:hue_lamp', form: 'large' },
			{ op: 'rename', ref: 'room:r-den', name: 'TV room' },
			{ op: 'config', ref: 'section:rooms', config: { layout: 'field' } }
		];
		const copy = copyOf(home(shared), shared);
		const drawn = drawnBuilt(copy);
		expect(drawn.map((s) => s.title)).toEqual(['Pinned', 'Scenes & modes', 'Rooms']);
		expect(drawn[0]!.refs).toEqual(['device:hue_lamp']);
		expect(drawn[2]!.layout).toBe('field');
		expect(copy.some((c) => c.ref.startsWith('piece:'))).toBe(false);
		expect(copy).toContainEqual({ op: 'form', ref: 'device:hue_lamp', form: 'large' });
		expect(copy).toContainEqual({ op: 'rename', ref: 'room:r-den', name: 'TV room' });
	});

	it('doesn’t follow the original: a new device doesn’t appear in it', () => {
		const copy = copyOf(
			roomPage('r-den', { devices, rooms, added: [], pluginCard: () => undefined })
		);
		const before = drawnBuilt(copy).flatMap((s) => s.refs);
		const lamp = devices.hue_lamp!;
		const more: Devices = {
			...devices,
			new_lamp: { ...lamp, device_id: 'new_lamp', name: 'New lamp' } as CoreDevice
		};
		expect(drawnBuilt(copy, more).flatMap((s) => s.refs)).toEqual(before);
		expect(before).toContain('device:hue_lamp');
	});

	it('a plugin’s or the app’s card is a new one, so the copy’s settings are its own', () => {
		const shared: Change[] = [
			{ op: 'add', ref: 'kind:text/abc' },
			{ op: 'config', ref: 'kind:text/abc', config: { text: 'Hi' } }
		];
		const copy = copyOf(home(shared), shared);
		const add = copy.find((c) => c.op === 'add' && c.ref.startsWith('kind:text/'))!;
		expect(add.ref).not.toBe('kind:text/abc');
		expect(copy).toContainEqual({ op: 'config', ref: add.ref, config: { text: 'Hi' } });
	});

	it('leaves out what is hidden', () => {
		const copy = copyOf(home(), [{ op: 'hide', ref: 'section:scenes' }]);
		expect(drawnBuilt(copy).map((s) => s.title)).toEqual(['Rooms']);
	});
});

describe('pages in the phone bar (G30)', () => {
	it('Pages joins the default bar once there are pages', () => {
		expect(houseBar(undefined, [])).toEqual(['home', 'scenes', 'alerts']);
		expect(houseBar(house, [])).toEqual(['home', 'pages', 'scenes', 'alerts']);
		expect(barOf(person, [])).toEqual(['home', 'pages', 'scenes', 'alerts']);
	});

	it('a page in the bar: the house’s for everyone, one’s own for oneself, gone ones dropped', () => {
		const mine = { ...person, bar: ['home', 'page:kitchen', 'page:movie', 'page:gone'] };
		expect(barOf(mine, [], house)).toEqual(['home', 'page:kitchen', 'page:movie']);
		const pages = listPages(house, mine);
		expect(barFor(['page:kitchen'], [], pages)[0]).toMatchObject({
			label: 'Kitchen panel',
			href: '/pages/kitchen',
			symbol: 'kitchen'
		});
	});

	it('“In my phone bar” puts it in place of Pages, else at the end, else last', () => {
		expect(withPageInBar(['home', 'pages', 'scenes'], 'k', true, 4)).toEqual([
			'home',
			'page:k',
			'scenes'
		]);
		expect(withPageInBar(['home', 'scenes'], 'k', true, 4)).toEqual(['home', 'scenes', 'page:k']);
		expect(withPageInBar(['home', 'scenes', 'alerts', 'search'], 'k', true, 4)).toEqual([
			'home',
			'scenes',
			'alerts',
			'page:k'
		]);
	});

	it('taken out, Pages goes back where it was', () => {
		expect(withPageInBar(['home', 'page:k', 'scenes'], 'k', false, 4)).toEqual([
			'home',
			'pages',
			'scenes'
		]);
		expect(withPageInBar(['home', 'pages', 'page:k'], 'k', false, 4)).toEqual(['home', 'pages']);
	});
});

describe('pages on displays (G31)', () => {
	it('offers the house’s pages, never a person’s', () => {
		expect(displayPages(house).map((p) => p.id)).toEqual(['kitchen']);
	});

	it('shows a page as a tab, may be there, and skips one that’s gone', () => {
		const tabs = tabsFor({ version: 1, pages: ['page:kitchen', 'page:gone', 'home'] }, rooms, [
			{ id: 'kitchen', name: 'Kitchen panel' }
		]);
		expect(tabs.map((t) => t.href)).toEqual(['/pages/kitchen', '/']);
		expect(allowedOn(tabs, '/pages/kitchen')).toBe(true);
		expect(allowedOn(tabs, '/pages/other')).toBe(false);
	});

	it('put on a display, a page goes first, where it rests', () => {
		expect(withPageOnDisplay(['home', 'room:r-den'], 'k', true)).toEqual([
			'page:k',
			'home',
			'room:r-den'
		]);
		expect(withPageOnDisplay(['page:k', 'home'], 'k', false)).toEqual(['home']);
	});
});
