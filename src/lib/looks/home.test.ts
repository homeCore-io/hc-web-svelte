import { describe, expect, it } from 'vitest';
import { applyPage, homePage } from '../page.js';
import { homeChanges } from './home.js';
import { homeStyle } from '../styles.js';
import { HOUSE, ROOMS } from '../fixtures/house.js';
import { roomFromCore } from '../house.js';
import type { Devices } from '../devices.js';

describe('Home as a look groups it (13 §8.3)', () => {
	it('is nothing until a look says how', () => {
		expect(homeChanges(undefined)).toEqual([]);
	});

	it('orders sections, starts some hidden, and picks a layout that Customise reads back', () => {
		const changes = homeChanges({
			order: ['rooms', 'scenes'],
			hidden: ['playing'],
			layout: 'tiles'
		});
		expect(homeStyle(changes, 'names')).toBe('tiles');
		const devices: Devices = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
		const home = homePage({
			devices,
			rooms: ROOMS.map(roomFromCore),
			scenes: [],
			favourites: [],
			added: [],
			pluginCard: () => undefined,
			alerts: 0,
			chips: [],
			mode: null
		});
		const ids = applyPage(home, changes)
			.sections.filter((s) => !s.hidden)
			.map((s) => s.section.id);
		expect(ids.indexOf('rooms')).toBeLessThan(ids.indexOf('scenes'));
		expect(ids).not.toContain('playing');
	});
});
