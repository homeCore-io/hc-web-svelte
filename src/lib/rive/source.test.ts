import { describe, expect, it } from 'vitest';
import type { LookSlot } from '../pluginUi/uis.svelte.js';
import { isRiveSlot } from './source.js';

const slot = (rive: string, values?: number): LookSlot => ({
	id: 'plugin:plugin.x/hc-x-dial',
	pluginId: 'plugin.x',
	ui: { host_api: 1, version: '1', build: 'abc', entry: 'index.js', slots: [] },
	slot: {
		slot: 'look.drawing',
		element: 'hc-x-dial',
		label: 'Dial',
		draws: ['climate'],
		rive,
		values
	}
});

describe('a plugin’s Rive drawing', () => {
	it('is a .riv file inside its UI folder', () => {
		expect(isRiveSlot(slot('dial.riv'))).toBe(true);
		expect(isRiveSlot(slot('art/dial.riv'))).toBe(true);
		expect(isRiveSlot(slot('../dial.riv'))).toBe(false);
		expect(isRiveSlot(slot('/dial.riv'))).toBe(false);
		expect(isRiveSlot(slot('dial.js'))).toBe(false);
	});

	it('is left out when it expects newer values than this app gives', () => {
		expect(isRiveSlot(slot('dial.riv', 1))).toBe(true);
		expect(isRiveSlot(slot('dial.riv', 2))).toBe(false);
	});
});
