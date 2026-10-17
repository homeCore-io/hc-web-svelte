import { describe, expect, it } from 'vitest';
import { search, type Corpus } from './search.js';
import { HOUSE, ROOMS } from './fixtures/house.js';
import { roomFromCore } from './house.js';

const corpus: Corpus = {
	devices: HOUSE,
	rooms: ROOMS.map(roomFromCore),
	scenes: [{ id: 's1', name: 'Dinner' }],
	pages: [
		{ href: '/', title: 'Home' },
		{ href: '/scenes', title: 'Scenes' }
	]
};
const titles = (q: string) => search(q, corpus).map((h) => h.title);

describe('search (N8)', () => {
	it('finds a room by the start of its name, first', () => {
		expect(titles('kit')[0]).toBe('Kitchen');
	});

	it('every word must match somewhere — name, room or kind', () => {
		expect(titles('den lamp')).toEqual(['Reading lamp']);
		expect(titles('kitchen door')).toEqual(['Back door']);
	});

	it('finds things by what they are', () => {
		expect(titles('leak').sort()).toEqual(['Under sink', 'Water heater']);
	});

	it('scenes, homeCore’s and plugins’, are scenes', () => {
		expect(search('dinner', corpus)[0]).toMatchObject({ type: 'scene', id: 's1' });
		expect(search('movie', corpus)[0]).toMatchObject({ type: 'scene', id: 'caseta_scene_movie' });
	});

	it('pages, by name', () => {
		expect(search('scen', corpus)[0]).toMatchObject({ type: 'page', href: '/scenes' });
	});

	it('says where a device is', () => {
		expect(search('reading', corpus)[0]).toMatchObject({ type: 'device', detail: 'Den · Light' });
	});

	it('nothing typed, nothing found', () => {
		expect(search('  ', corpus)).toEqual([]);
		expect(titles('zzz')).toEqual([]);
	});
});

describe('rules and settings', () => {
	it('finds a rule by name, and a settings page by its words, when given them', () => {
		const corpus = {
			devices: [],
			rooms: [],
			scenes: [],
			pages: [],
			rules: [{ id: 'r1', name: 'Porch at sunset' }],
			settings: [{ slug: 'data', label: 'Data & backups', words: 'backup restore calendars' }]
		};
		expect(search('porch', corpus)[0]).toMatchObject({
			href: '/settings/automations/r1',
			detail: 'Rule'
		});
		expect(search('restore', corpus)[0]).toMatchObject({ href: '/settings/data' });
		expect(search('porch', { ...corpus, rules: undefined })).toEqual([]);
	});
});
