import { describe, expect, it } from 'vitest';
import {
	SETTINGS,
	hasSettings,
	mayOpen,
	backupDue,
	daysAgo,
	found,
	matches,
	settingsItem,
	size,
	uptime
} from './settings.js';

describe('settings', () => {
	it('every item has a unique address', () => {
		expect(new Set(SETTINGS.map((s) => s.slug)).size).toBe(SETTINGS.length);
		expect(settingsItem('configuration')?.coming).toBeUndefined();
		expect(settingsItem('people')?.coming).toBeUndefined();
		expect(SETTINGS.filter((x) => x.coming)).toEqual([]);
	});

	it('search matches word starts, every word', () => {
		expect(found('Server port and host', 'port')).toBe(true);
		expect(found('import export reports', 'port')).toBe(false);
		expect(found('Pushover, email', 'push em')).toBe(true);
		expect(found('Pushover', 'push telegram')).toBe(false);
		expect(matches(settingsItem('notifications')!, 'pushover')).toBe(true);
		expect(matches(settingsItem('data')!, 'last backup', 'Last backup today')).toBe(true);
	});

	it('says times and sizes as a person would', () => {
		const now = Date.parse('2026-10-16T12:00:00Z');
		expect(daysAgo('2026-08-02T12:00:00Z', now)).toBe('75 days ago');
		expect(daysAgo('2026-10-16T01:00:00Z', now)).toBe('today');
		expect(daysAgo('2026-10-15T01:00:00Z', now)).toBe('yesterday');
		expect(size(2_600_000_000)).toBe('2.6 GB');
		expect(size(512)).toBe('512 bytes');
		expect(uptime(600)).toBe('10 min');
		expect(uptime(7200)).toBe('2 h');
		expect(uptime(4 * 86400)).toBe('4 days');
	});

	it('a backup is due when there is none, or it is over a month old', () => {
		const now = Date.parse('2026-10-16T12:00:00Z');
		expect(backupDue(null, now)).toBe(true);
		expect(backupDue('2026-08-02T12:00:00Z', now)).toBe(true);
		expect(backupDue('2026-10-10T12:00:00Z', now)).toBe(false);
	});
});

describe('who may open what', () => {
	const item = (slug: string) => SETTINGS.find((s) => s.slug === slug)!;
	const scopes =
		(...list: string[]) =>
		(s: string) =>
			list.includes(s);
	it('each item by the scope its changes take; system and displays for admins', () => {
		const editor = scopes('automations:read', 'automations:write', 'devices:read');
		expect(mayOpen(item('automations'), editor, false)).toBe(true);
		expect(mayOpen(item('events'), editor, false)).toBe(true);
		expect(mayOpen(item('devices'), editor, false)).toBe(false);
		expect(mayOpen(item('displays'), editor, false)).toBe(false);
		expect(mayOpen(item('system'), editor, false)).toBe(false);
		expect(mayOpen(item('system'), scopes(), true)).toBe(true);
		expect(hasSettings(scopes('devices:read'), false)).toBe(true);
		// An observer reads the audit and the plugins, and changes nothing.
		const observer = scopes('audit:read', 'plugins:read', 'devices:read');
		expect(mayOpen(item('audit'), observer, false)).toBe(true);
		expect(mayOpen(item('plugins'), observer, false)).toBe(true);
		expect(mayOpen(item('logs'), observer, false)).toBe(false);
		expect(hasSettings(scopes(), false)).toBe(false);
	});
});
