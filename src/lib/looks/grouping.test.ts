import { describe, expect, it } from 'vitest';
import { HOUSE, ROOMS, FIXTURE_NOW } from '../fixtures/house.js';
import { roomFromCore } from '../house.js';
import type { Devices } from '../devices.js';
import { groupRoom } from './grouping.js';
import { LIT, type Rule } from './model.js';

const devices: Devices = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
const rooms = ROOMS.map(roomFromCore);
const input = { devices, rooms, added: [], pluginCard: () => undefined, now: FIXTURE_NOW };
const page = (id: string, rules: readonly Rule[] = LIT.grouping.room!) =>
	groupRoom(id, input, rules);
const where = (p: ReturnType<typeof page>, ref: string) =>
	p.sections.find((s) => s.cards.some((c) => c.ref === ref))?.id;

describe('Lit’s grouping of a room (13 §8.2)', () => {
	it('is the page document, drawn in columns, under the room’s own key', () => {
		const p = page('r-den');
		expect(p.id).toBe('room:r-den');
		expect(p.columns).toBe(true);
		expect(p.sections.map((s) => s.id).slice(0, 4)).toEqual(['head', 'needs', 'doors', 'lights']);
	});

	it('starts with the header and what needs someone, as cards that can be arranged', () => {
		const p = page('r-den');
		expect(p.sections[0]?.cards[0]?.kind).toBe('roomhead');
		expect(p.sections[1]?.cards[0]?.kind).toBe('needs');
	});

	it('puts each kind of thing in its section', () => {
		const den = page('r-den');
		expect(where(den, 'device:hue_lamp')).toBe('lights');
		expect(where(den, 'device:ecowitt_den')).toBe('readings');
		const garage = page('r-garage');
		expect(where(garage, 'device:shelly_heater')).toBe('power');
		const hall = page('r-hall');
		expect(where(hall, 'device:yolink_front_lock')).toBe('doors');
		expect(where(hall, 'device:lutron_keypad')).toBe('more');
	});

	it('lays scenes out as swatches, switches in a panel, sensors in lines, the rest folded', () => {
		const layouts = Object.fromEntries(page('r-den').sections.map((s) => [s.id, s.layout]));
		expect(layouts).toMatchObject({
			scenes: 'swatches',
			switches: 'panel',
			power: 'panel',
			watching: 'lines',
			more: 'fold'
		});
	});
});

describe('a look’s own rules (13 §8.1)', () => {
	it('gives a thing to the first rule that takes it', () => {
		const rules: Rule[] = [
			{
				id: 'all-lights',
				title: 'All lights',
				takes: ['lights', 'switches.lights'],
				layout: 'grid',
				place: 'main'
			},
			{ id: 'lights', title: 'Lights', takes: ['lights'], layout: 'grid', place: 'main' }
		];
		const p = page('r-den', rules);
		expect(where(p, 'device:hue_lamp')).toBe('all-lights');
		expect(p.sections.find((s) => s.id === 'lights')?.cards).toEqual([]);
	});

	it('puts what no rule takes in Also here, so nothing is lost', () => {
		const p = page('r-garage', [
			{ id: 'lights', title: 'Lights', takes: ['lights'], layout: 'grid', place: 'main' }
		]);
		expect(where(p, 'device:shelly_heater')).toBe('added');
		expect(p.sections.at(-1)?.title).toBe('Also here');
	});
});

describe('a look’s frame in a room (13 §7)', () => {
	it('leaves out what needs someone, and unfolds More, when the frame says so', () => {
		const p = groupRoom('r-hall', input, LIT.grouping.room!, { needs: false, more: false });
		expect(p.sections.some((s) => s.id === 'needs')).toBe(false);
		const more = p.sections.find((s) => s.id === 'more')!;
		expect(more.layout).toBe('grid');
		expect(more.headless).toBeFalsy();
	});
});

describe('a section laid out for how its things are drawn (13 §13.1)', () => {
	it('lists rows, lines up chips, and keeps a layout chosen otherwise', () => {
		const p = groupRoom('r-den', input, LIT.grouping.room!, undefined, false, {
			lights: 'chip',
			switches: 'row',
			readings: 'band'
		});
		const layout = (id: string) => p.sections.find((s) => s.id === id)?.layout;
		expect(layout('lights')).toBe('chips');
		expect(layout('switches')).toBe('list');
		expect(layout('power')).toBe('list');
		expect(layout('readings')).toBe('grid');
		expect(layout('scenes')).toBe('swatches');
	});

	it('includes every battery in the room as one piece, leaving each thing where it is', () => {
		const p = page('r-hall');
		const batteries = p.sections.find((s) => s.id === 'batteries');
		expect(batteries?.cards.map((c) => c.kind)).toEqual(['batteries']);
		expect(where(p, 'device:yolink_front_lock')).toBe('doors');
	});
});
