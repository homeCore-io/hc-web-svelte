import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import { TABS } from './room.js';
import { choiceFor, ownTab, popoverAt, tabIn, TAB_HINTS } from './placing.js';

const dev = (id: string, type: string, attributes: Record<string, unknown> = {}): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	plugin_id: 'plugin.test',
	available: true,
	attributes
});

const garage = [
	dev('Auto Garage Door', 'switch', { on: false }),
	dev('Bench Light', 'light', { on: true, brightness_pct: 40 }),
	dev('Freezer Plug', 'switch', { on: true }),
	dev('Leak', 'leak_sensor', { wet: false }),
	dev('Hub', 'gateway')
];

describe('which tab a device is on', () => {
	it('is the tab it sorts to, with no choice', () => {
		expect(tabIn(garage, 'Auto Garage Door')).toBe('doors');
		expect(tabIn(garage, 'Bench Light')).toBe('lights');
		expect(tabIn(garage, 'Leak')).toBe('water');
	});
	it('is the household’s choice when there is one', () => {
		expect(tabIn(garage, 'Auto Garage Door', { 'Auto Garage Door': 'switches' })).toBe('switches');
		expect(tabIn(garage, 'Leak', { Leak: 'sensors' })).toBe('sensors');
	});
	it('is none for a hub, which no tab shows', () => {
		expect(tabIn(garage, 'Hub')).toBeUndefined();
		expect(tabIn(garage, 'Missing')).toBeUndefined();
	});
	it('puts a plain switch chosen for Lights in its switches column', () => {
		expect(tabIn(garage, 'Auto Garage Door', { 'Auto Garage Door': 'lights' })).toBe('lights');
	});
});

describe('where a device lands by itself', () => {
	it('leaves out its own choice, and keeps the others’', () => {
		const chosen = { 'Auto Garage Door': 'switches', 'Freezer Plug': 'doors' } as const;
		expect(ownTab(garage, 'Auto Garage Door', chosen)).toBe('doors');
		expect(ownTab(garage, 'Freezer Plug', chosen)).toBe('lights');
		expect(tabIn(garage, 'Freezer Plug', chosen)).toBe('doors');
	});
});

describe('what choosing a tab saves', () => {
	it('saves a tab other than its own', () => {
		expect(choiceFor('switches', 'doors')).toBe('switches');
	});
	it('saves nothing for its own tab, so it sorts itself again', () => {
		expect(choiceFor('doors', 'doors')).toBeUndefined();
		expect(choiceFor(undefined, 'doors')).toBeUndefined();
	});
	it('names a hint for every tab', () => {
		for (const t of TABS) expect(TAB_HINTS[t.id]).toBeTruthy();
	});
});

describe('where the picker sits', () => {
	const view = { width: 1280, height: 720 };
	const size = { width: 300, height: 360 };
	it('goes under its button, right edges together', () => {
		const at = popoverAt({ left: 600, top: 200, width: 22, height: 22 }, size, view);
		expect(at).toEqual({ left: 322, top: 228 });
	});
	it('goes above when there is more room there', () => {
		const at = popoverAt({ left: 600, top: 600, width: 22, height: 22 }, size, view);
		expect(at.top).toBe(600 - 6 - 360);
	});
	it('stays inside the window at its edges', () => {
		const left = popoverAt({ left: 10, top: 100, width: 22, height: 22 }, size, view);
		expect(left.left).toBe(8);
		const tall = popoverAt(
			{ left: 1250, top: 380, width: 22, height: 22 },
			{ width: 300, height: 600 },
			view
		);
		expect(tall.left + 300).toBeLessThanOrEqual(1272);
		expect(tall.top).toBeGreaterThanOrEqual(8);
		expect(tall.top + 600).toBeLessThanOrEqual(712);
	});
});
