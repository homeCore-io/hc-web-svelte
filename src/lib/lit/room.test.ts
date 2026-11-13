import { describe, expect, it } from 'vitest';
import { HOUSE, FIXTURE_NOW } from '../fixtures/house.js';
import { cardFor, type CardView } from '../card.js';
import type { CoreDevice } from '../devices.js';
import type { Card } from '../page.js';
import {
	colourOf,
	houseScene,
	isGroup,
	kelvinToRgb,
	litRoom,
	shownReading,
	stemOf,
	xyToRgb
} from './room.js';

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

describe('sensors and house scenes in the Lit look', () => {
	it('gives a temperature sensor its day, and other sensors a line each', () => {
		const r = room([byId('ecowitt_den'), byId('yolink_leak'), byId('hue_motion')]);
		expect(r.readings.map((x) => [x.card.ref, x.attr])).toEqual([
			['device:ecowitt_den', 'temperature']
		]);
		expect(r.watch.map((w) => w.card.ref)).toEqual(['device:yolink_leak', 'device:hue_motion']);
	});

	it('keeps a sensor’s own safe range, when it has one', () => {
		const den = byId('ecowitt_den');
		const probe = {
			...den,
			attributes: { ...den.attributes, temp_limit_low: -20, temp_limit_high: -5 }
		};
		expect(room([probe]).readings[0]?.range).toEqual({ low: -20, high: -5 });
	});

	it('reads a °F sensor in its own unit, not as °C converted again', () => {
		const den = byId('ecowitt_den');
		const station = {
			...den,
			attributes: { ...den.attributes, temperature: 69.6, temperature_unit: 'F' }
		};
		const r = room([station]).readings[0]!;
		// The tests read in °C: 69.6 °F is 20.9 °C, never 69.6 °C taken as 157 °F.
		expect(shownReading(r, 69.6)).toBeCloseTo(20.89, 1);
		const celsius = { ...den, attributes: { ...den.attributes, temperature: 21 } };
		delete (celsius.attributes as Record<string, unknown>).temperature_unit;
		expect(shownReading(room([celsius]).readings[0]!, 21)).toBe(21);
		// Humidity is a percentage, whatever the temperature's unit.
		expect(shownReading({ ...r, attr: 'humidity' }, 54)).toBe(54);
	});

	it('reads a house scene from what it sets: dark, a lock, its words', () => {
		const devices = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
		const night = houseScene(
			{ hue_lamp: { on: false }, yolink_front_lock: { locked: true } },
			devices
		);
		expect(night.dark).toBe(true);
		expect(night.badges).toEqual(['lock']);
		expect(night.does).toBe('Lights off · locks');
		const evening = houseScene({ hue_lamp: { on: true, color_temp: 2700 } }, devices);
		expect(evening.dark).toBe(false);
		expect(evening.colours).toHaveLength(1);
	});
});
