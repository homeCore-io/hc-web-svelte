import { describe, expect, it } from 'vitest';
import { HOUSE } from './fixtures/house.js';
import { kindOf, kinds } from './kinds.js';
import type { Card } from './page.js';

const lamp = HOUSE.find((d) => d.device_id === 'hue_lamp')!;
type DeviceCard = Extract<Card, { kind: 'device' }>;
const device = (extra: Partial<DeviceCard> = {}): DeviceCard => ({
	ref: 'device:hue_lamp',
	kind: 'device',
	device: lamp,
	scene: false,
	...extra
});

describe('kinds of card (G2)', () => {
	it('a device card is standard unless given a size, or generated large', () => {
		expect(kindOf(device()).form(device(), undefined)).toBe('standard');
		expect(kinds.device.form(device({ form: 'large' }), undefined)).toBe('large');
		expect(kinds.device.form(device({ form: 'large' }), 'compact')).toBe('compact');
		expect(kinds.device.forms(device())).toEqual(['compact', 'standard', 'large']);
	});

	it("a plugin's scene is a button, with no sizes", () => {
		const s = device({ scene: true });
		expect(kinds.device.forms(s)).toEqual([]);
		expect(kinds.device.form(s, 'large')).toBeUndefined();
	});

	it("a plugin's card is only the sizes it can be, its first by default", () => {
		const card: Extract<Card, { kind: 'plugin' }> = {
			ref: 'card:p/e/1',
			kind: 'plugin',
			label: 'Wall',
			forms: ['large', 'standard']
		};
		expect(kinds.plugin.forms(card)).toEqual(['standard', 'large']);
		expect(kinds.plugin.form(card, undefined)).toBe('large');
		expect(kinds.plugin.form(card, 'compact')).toBe('large');
		expect(kinds.plugin.form(card, 'standard')).toBe('standard');
		expect(kinds.plugin.form({ ...card, forms: undefined }, undefined)).toBe('standard');
	});

	it('rooms, scenes and the pieces have one shape; rooms and pieces are never starred', () => {
		expect(kinds.room.star).toBe(false);
		expect(kinds.scene.star).toBe(true);
		expect(kinds.alerts.forms({ ref: 'piece:alerts/home', kind: 'alerts', count: 1 })).toEqual([]);
		expect(kinds.chips.name({ ref: 'piece:chips/home', kind: 'chips', chips: [] })).toBe(
			'What’s going on'
		);
	});
});
