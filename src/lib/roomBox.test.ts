import { describe, expect, it } from 'vitest';
import { cardFor } from './card.js';
import { fromList, type CoreDevice } from './devices.js';
import {
	ROOM_BUILT_IN,
	SUMMARY_BUILT_IN,
	prune,
	resolve,
	sourceOf,
	withDefaults,
	roomDescriptor
} from './options.js';
import { bigNumbers, fieldSize, readingOf, roomBox, sourced } from './roomBox.js';
import { styleChanges, styleOf, shellRooms } from './styles.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const C = { unit: '°C', kind: 'number', writable: false };
const dev = (
	id: string,
	device_type: string,
	attributes: Record<string, unknown>,
	extra: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type,
	available: true,
	attributes,
	schema: {
		attributes: Object.fromEntries(
			Object.keys(attributes).map((k) => [
				k,
				k === 'temperature'
					? C
					: k === 'humidity'
						? { ...C, unit: '%' }
						: k === 'on'
							? { kind: 'bool', writable: true }
							: { kind: 'number', writable: false }
			])
		)
	} as CoreDevice['schema'],
	...extra
});
const office = [
	dev('desk', 'temperature_sensor', { temperature: 21, humidity: 48 }),
	dev('motion', 'motion_sensor', { motion: true, temperature: 19 }),
	dev('lamp', 'light', { on: true }),
	dev('ceiling', 'light', { on: false })
];
const all = fromList([...office, dev('far', 'temperature_sensor', { temperature: 30 })]);
const box = (o = {}) => {
	const devices = office;
	return roomBox(
		devices,
		devices.map((d) => cardFor(d, NOW)),
		all,
		resolve([o], ROOM_BUILT_IN)
	);
};

describe('settings through the layers (G13)', () => {
	it('first set wins, setting by setting', () => {
		const card = { temperature: ['desk'] };
		const houseDefault = { temperature: 'none', fans: true };
		expect(resolve([undefined, card, undefined, houseDefault], ROOM_BUILT_IN)).toMatchObject({
			temperature: ['desk'],
			fans: true,
			big: 'temperature'
		});
	});

	it('a layer keeps only what differs from what would apply anyway', () => {
		expect(prune({ fans: false, big: 'humidity', lights: undefined }, ROOM_BUILT_IN)).toEqual({
			big: 'humidity'
		});
	});

	it('the sheet’s defaults are what applies without this layer', () => {
		const d = withDefaults(roomDescriptor(), { big: 'lights' });
		expect(d.sections[0]!.fields[0]!.default).toBe('lights');
	});

	it('a source is the natural one unless it says otherwise', () => {
		expect(sourceOf(undefined)).toBe('auto');
		expect(sourceOf([])).toBe('auto');
		expect(sourceOf('none')).toBe('none');
		expect(sourceOf(['a', 'b'])).toEqual(['a', 'b']);
	});
});

describe('readings', () => {
	it('in the person’s units, and only from devices that answer', () => {
		expect(readingOf(office[0]!, 'temperature')).toBe(21);
		expect(readingOf({ ...office[0]!, available: false }, 'temperature')).toBeUndefined();
	});

	it('the room’s average, one sensor, an average of chosen ones, or none', () => {
		expect(sourced('auto', 'temperature', all, office)).toBe(20);
		expect(sourced(['desk'], 'temperature', all, office)).toBe(21);
		expect(sourced(['desk', 'far'], 'temperature', all, office)).toBe(25.5);
		expect(sourced('none', 'temperature', all, office)).toBeUndefined();
		expect(sourced(['gone'], 'temperature', all, office)).toBeUndefined();
	});
});

describe('a room’s box', () => {
	it('shows the temperature big, then lights and humidity', () => {
		const b = box();
		expect(b.big).toBe('20°');
		expect(b.lines.map((l) => l.text)).toEqual(['1 of 2 lights on', '48%']);
		expect(b.glow).toBe(0.5);
		expect(b.badges.map((x) => x.label)).toEqual(['Someone here']);
	});

	it('takes its temperature from a sensor chosen, or none', () => {
		expect(box({ temperature: ['desk'] }).big).toBe('21°');
		expect(box({ temperature: 'none' }).big).toBeUndefined();
	});

	it('lights as the big number, and details switched off', () => {
		const b = box({ big: 'lights', people: false, lights: false });
		expect(b.big).toBe('1/2');
		expect(b.glow).toBe(0);
		expect(b.badges).toEqual([]);
	});

	it('always says what’s wrong, whatever is switched off (G6)', () => {
		const wet = [
			...office,
			dev('leak', 'water_sensor', { water_detected: true }),
			dev('door', 'contact_sensor', { open: true })
		];
		const b = roomBox(
			wet,
			wet.map((d) => cardFor(d, NOW)),
			all,
			resolve([{ lights: false, doors: false }], ROOM_BUILT_IN)
		);
		expect(b.alarm).toBe(true);
		expect(b.lines.filter((l) => l.alert).map((l) => l.text)).toEqual(['Leak', 'door open']);
	});

	it('offers All off only while something is on, and only if asked', () => {
		expect(box().allOff.map((c) => c.id)).toEqual(['lamp']);
		expect(box({ allOff: false }).allOff).toEqual([]);
	});

	it('is sized in the field by how much is in the room', () => {
		expect([fieldSize(2), fieldSize(6), fieldSize(14)]).toEqual([1, 2, 3]);
	});
});

describe('the big numbers', () => {
	const rooms = [{ name: 'Office', devices: office, cards: office.map((d) => cardFor(d, NOW)) }];
	const h = { all, rooms, cards: Object.values(all).map((d) => cardFor(d, NOW)) };

	it('in the order chosen, each with a word under it', () => {
		const n = bigNumbers(h, SUMMARY_BUILT_IN);
		expect(n.map((x) => [x.id, x.value, x.sub])).toEqual([
			['inside', '20', 'average of 1 room'],
			['outside', '—', 'no weather station'],
			['lights', '1', 'in 1 room'],
			['playing', '0', 'nothing playing'],
			['open', '0', 'all shut']
		]);
	});

	it('take a chosen sensor, and drop what isn’t a number they know', () => {
		const n = bigNumbers(h, {
			...SUMMARY_BUILT_IN,
			numbers: ['outside', 'bogus', 'outside', 'humidity'],
			outside: ['far']
		});
		expect(n.map((x) => [x.id, x.value, x.sub])).toEqual([
			['outside', '30', 'far'],
			['humidity', '48', 'average of 1 room']
		]);
	});
});

describe('styles (G3)', () => {
	it('are read back from what they write', () => {
		for (const s of ['list', 'field', 'tiles', 'side'] as const) {
			const { changes, rooms } = styleChanges(s);
			const layout = (changes[0] as unknown as { config: { layout: string } }).config.layout;
			expect(styleOf(layout, rooms)).toBe(s);
		}
	});

	it('show the big numbers but in the list', () => {
		expect(styleChanges('list').changes[1]).toEqual({ op: 'hide', ref: 'section:summary' });
		expect(styleChanges('tiles').changes[1]).toEqual({ op: 'show', ref: 'section:summary' });
	});

	it('the sidebar’s rooms: the person’s, else the household’s', () => {
		expect(shellRooms(undefined, undefined)).toBe('names');
		expect(shellRooms({}, { shell: { rooms: 'status' } })).toBe('status');
		expect(shellRooms({ shell: { rooms: 'names' } }, { shell: { rooms: 'status' } })).toBe('names');
	});
});
