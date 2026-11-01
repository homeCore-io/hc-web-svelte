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
import {
	bigNumbers,
	fieldPlan,
	fieldText,
	readingOf,
	roomBox,
	sourced,
	type Box
} from './roomBox.js';
import { homeStyle, styleChanges, styleOf, shellRooms } from './styles.js';

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

	it('a reading kept in °F from an older plugin averages as °F, not °C', () => {
		// Declared °C, written 71.6 with temperature_unit F: 22 °C, not 71.6.
		const stale = dev('hue', 'motion_sensor', { temperature: 71.6, temperature_unit: 'F' });
		const house = fromList([...office, stale]);
		expect(readingOf(stale, 'temperature')).toBeCloseTo(22, 5);
		expect(house.hue!.schema!.attributes.temperature!.unit).toBe('°F');
		expect(sourced(['desk', 'hue'], 'temperature', house, office)).toBeCloseTo(21.5, 5);
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
});

describe('the room field (mockup A)', () => {
	it('a big box: the number, lights then humidity, a note; a small one: one short line', () => {
		const t = fieldText(box());
		expect(t.line).toBe('1 of 2 lights on · 48%');
		expect(t.short).toBe('20° · 1/2 on');
		expect(t.brief).toBe('1/2 on');
		expect(t.lit).toBe(true);
		expect(t.note).toBeUndefined();
		const dark = fieldText(box({ temperature: 'none', lights: false, humidity: 'none' }));
		expect([dark.line, dark.short, dark.lit]).toEqual(['', 'All quiet', false]);
	});

	it('lights as the big number aren’t said again', () => {
		const t = fieldText(box({ big: 'lights' }));
		expect(t.line).toBe('48%');
		expect(t.short).toBe('1/2 on');
	});

	it('marks what’s wrong first, then who’s about; what’s wrong is a small box’s line (G6)', () => {
		const more = [
			...office,
			dev('door', 'contact_sensor', { open: true }),
			dev('plug', 'switch', { on: true }, { available: false })
		];
		const b = roomBox(
			more,
			more.map((d) => cardFor(d, NOW)),
			all,
			resolve([{ doors: false }], ROOM_BUILT_IN)
		);
		expect(b.marks.map((m) => [m.icon, m.tone])).toEqual([
			['door-open', 'alert'],
			['motion', 'calm']
		]);
		const t = fieldText(b);
		// The door is its mark; what's offline is the note, and a small box's line.
		expect(t.note).toEqual({ text: 'plug offline', alert: true, what: 'offline' });
		expect(t.wrong?.text).toBe('plug offline');
	});

	const quiet = (): Box => ({ ...box({ lights: false, people: false }), lines: [], marks: [] });
	const busy = (on: number, marks = 0): Box => ({
		...quiet(),
		lights: { on, of: 8 },
		marks: Array.from({ length: marks }, () => ({ icon: 'fan', label: 'Fan on', tone: 'calm' }))
	});

	it('the three busiest fill a row three tall, the next two are two tall, the rest two by two', () => {
		const rooms = [
			{ ref: 'room:a', box: quiet() },
			{ ref: 'room:b', box: busy(1) },
			{ ref: 'room:c', box: busy(4, 3) },
			{ ref: 'room:d', box: busy(2) },
			{ ref: 'room:e', box: busy(4) },
			{ ref: 'room:f', box: busy(1, 1) },
			{ ref: 'room:g', box: quiet() }
		];
		const plan = fieldPlan(rooms);
		expect(plan.map((p) => [p.ref, p.cols, p.rows, p.big])).toEqual([
			['room:c', 5, 3, true],
			['room:e', 4, 3, true],
			['room:d', 3, 3, true],
			// The next two keep their order.
			['room:b', 3, 2, true],
			['room:f', 3, 2, true],
			['room:a', 2, 2, false],
			['room:g', 2, 2, false]
		]);
		expect(plan.map((p) => `${p.phoneCols}x${p.phoneRows}`)).toEqual([
			'2x2',
			'2x2',
			'2x2',
			'2x1',
			'2x1',
			'1x1',
			'1x1'
		]);
	});

	it('fills its rows when fewer rooms are busy, and a quiet room is never big', () => {
		const one = fieldPlan([
			{ ref: 'a', box: quiet() },
			{ ref: 'b', box: busy(2) }
		]);
		expect(one.map((p) => [p.ref, p.cols, p.big])).toEqual([
			['b', 6, true],
			['a', 2, false]
		]);
		const two = fieldPlan([
			{ ref: 'a', box: busy(1) },
			{ ref: 'b', box: busy(3) }
		]);
		expect(two.map((p) => [p.ref, p.cols])).toEqual([
			['b', 6],
			['a', 6]
		]);
		const four = fieldPlan(['a', 'b', 'c', 'd'].map((ref, i) => ({ ref, box: busy(4 - i) })));
		expect(four.at(-1)).toMatchObject({ ref: 'd', cols: 4, rows: 2 });
		expect(fieldPlan([{ ref: 'x' }])[0]).toMatchObject({ big: false, cols: 2 });
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

	it('Home’s style read from its changes as shown', () => {
		expect(homeStyle([], 'names')).toBe('list');
		expect(homeStyle(styleChanges('field').changes, 'names')).toBe('field');
		expect(homeStyle(styleChanges('field').changes, 'status')).toBe('side');
	});

	it('the sidebar’s rooms: the person’s, else the household’s', () => {
		expect(shellRooms(undefined, undefined)).toBe('names');
		expect(shellRooms({}, { shell: { rooms: 'status' } })).toBe('status');
		expect(shellRooms({ shell: { rooms: 'names' } }, { shell: { rooms: 'status' } })).toBe('names');
	});
});
