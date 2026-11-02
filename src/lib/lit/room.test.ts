import { describe, expect, it } from 'vitest';
import { HOUSE, FIXTURE_NOW } from '../fixtures/house.js';
import { cardFor, type CardView } from '../card.js';
import type { CoreDevice } from '../devices.js';
import type { Card } from '../page.js';
import { colourOf, isGroup, kelvinToRgb, litRoom, stemOf, xyToRgb } from './room.js';

const byId = (id: string) => HOUSE.find((d) => d.device_id === id)!;
const asCard = (d: CoreDevice): Card => ({
	ref: `device:${d.device_id}`,
	kind: 'device',
	device: d,
	scene: d.device_type === 'scene'
});
function room(devices: CoreDevice[], names: Record<string, string> = {}) {
	const cards = devices.map(asCard);
	const views: Record<string, CardView> = Object.fromEntries(
		devices.map((d) => [`device:${d.device_id}`, cardFor(d, FIXTURE_NOW)])
	);
	return litRoom(cards, views, names);
}
const lightsOf = (r: ReturnType<typeof litRoom>) =>
	r.lights.map((x) => (isGroup(x) ? `group:${x.name}` : x.name));

describe('a room in the Lit look (12)', () => {
	it('puts dimming lights in cards, switches in the panel, power apart from lights', () => {
		const r = room([byId('hue_lamp'), byId('caseta_porch'), byId('shelly_heater')]);
		expect(lightsOf(r)).toEqual([cardFor(byId('hue_lamp'), FIXTURE_NOW).name]);
		expect(r.switches.lights.map((l) => l.card.ref)).toEqual(['device:caseta_porch']);
		expect(r.switches.power.map((l) => l.card.ref)).toEqual(['device:shelly_heater']);
	});

	it('groups lights or switches that share a name but a number, once there are two', () => {
		const names = {
			'device:caseta_porch': 'Holiday Lights 1',
			'device:hue_ceiling': 'Holiday Lights 2'
		};
		const r = room([byId('caseta_porch'), byId('hue_ceiling'), byId('hue_lamp')], names);
		expect(lightsOf(r)).toContain('group:Holiday Lights');
		expect(r.switches.lights).toEqual([]);
		const alone = room([byId('caseta_porch')], { 'device:caseta_porch': 'Holiday Lights 1' });
		expect(lightsOf(alone)).toEqual([]);
		expect(alone.switches.lights).toHaveLength(1);
		const zones = room([byId('caseta_porch'), byId('hue_ceiling')], {
			'device:caseta_porch': 'Zone 03',
			'device:hue_ceiling': 'Zone 04'
		});
		expect(lightsOf(zones)).not.toContain('group:Zone');
	});

	it('folds remotes and keypads away, and keeps a lock with the doors', () => {
		const r = room([byId('caseta_pico'), byId('lutron_keypad'), byId('yolink_front_lock')]);
		expect(r.more.map((c) => c.ref)).toEqual(['device:caseta_pico', 'device:lutron_keypad']);
		expect(r.doors.map((c) => c.ref)).toEqual(['device:yolink_front_lock']);
	});

	it('says an unlocked lock needs someone, with Lock as its fix', () => {
		const lock = byId('yolink_front_lock');
		const open = { ...lock, attributes: { ...lock.attributes, locked: false } };
		const r = room([open]);
		expect(r.problems[0]?.fix).toEqual({
			label: 'Lock',
			device: lock.device_id,
			want: { locked: true }
		});
	});

	it('glows only for what is on', () => {
		const lamp = byId('hue_lamp');
		const off = { ...lamp, attributes: { ...lamp.attributes, on: false } };
		expect(room([off]).glow).toEqual([]);
		expect(room([lamp]).glow.length).toBe(1);
	});
});

describe('a light’s colour', () => {
	it('reads xy, else colour temperature, else warm white', () => {
		for (const c of xyToRgb(0.3127, 0.329).split(',')) expect(Number(c)).toBeGreaterThan(240);
		expect(kelvinToRgb(2700).split(',')[0]).toBe('255');
		expect(Number(kelvinToRgb(2700).split(',')[2])).toBeLessThan(200);
		expect(colourOf({ ...byId('hue_lamp'), attributes: {} })).toBe('255,180,90');
	});

	it('takes the name’s stem for grouping', () => {
		expect(stemOf('Holiday Lights 3')).toBe('Holiday Lights');
		expect(stemOf('Pico')).toBeNull();
	});
});
