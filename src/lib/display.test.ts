import { describe, expect, it } from 'vitest';
import { allowedOn, nextTab, reloadDue, tabsFor } from './display.js';

const rooms = [
	{ id: 'k', name: 'Kitchen' },
	{ id: 'g', name: 'Garage' }
];

describe('a display’s pages (D7, N9)', () => {
	it('shows what the admin chose, in order, skipping rooms that have gone', () => {
		const tabs = tabsFor({ version: 1, pages: ['room:k', 'scenes', 'room:gone', 'scenes'] }, rooms);
		expect(tabs.map((t) => t.label)).toEqual(['Kitchen', 'Scenes']);
		expect(tabs[0]!.href).toBe('/rooms/k');
	});

	it('with nothing chosen, shows Home', () => {
		expect(tabsFor(undefined, rooms)).toEqual([{ key: 'home', label: 'Home', href: '/' }]);
		expect(tabsFor({ version: 1, pages: ['room:gone'] }, rooms)[0]!.key).toBe('home');
	});

	it('may be only on its own pages', () => {
		const tabs = tabsFor({ version: 1, pages: ['room:k', 'alerts'] }, rooms);
		expect(allowedOn(tabs, '/rooms/k')).toBe(true);
		expect(allowedOn(tabs, '/alerts')).toBe(true);
		expect(allowedOn(tabs, '/rooms/g')).toBe(false);
		expect(allowedOn(tabs, '/settings')).toBe(false);
		expect(allowedOn(tabs, '/')).toBe(false);
	});

	it('with Home among them, the rooms Home opens too', () => {
		const tabs = tabsFor({ version: 1, pages: ['home'] }, rooms);
		expect(allowedOn(tabs, '/rooms/g')).toBe(true);
		expect(allowedOn(tabs, '/me')).toBe(false);
	});

	it('swipes to the next page, and not past either end', () => {
		const tabs = tabsFor({ version: 1, pages: ['home', 'scenes', 'alerts'] }, rooms);
		expect(nextTab(tabs, '/', 1)?.href).toBe('/scenes');
		expect(nextTab(tabs, '/', -1)).toBeUndefined();
		expect(nextTab(tabs, '/alerts', 1)).toBeUndefined();
		expect(nextTab(tabs, '/rooms/k', 1)).toBeUndefined();
	});

	it('reloads once a day at the time set', () => {
		expect(reloadDue('04:00', new Date(2026, 9, 16, 4, 0, 30))).toBe(true);
		expect(reloadDue('04:00', new Date(2026, 9, 16, 4, 1))).toBe(false);
		expect(reloadDue(null, new Date())).toBe(false);
	});
});
