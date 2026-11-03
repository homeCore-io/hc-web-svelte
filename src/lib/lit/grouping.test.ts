import { describe, expect, it } from 'vitest';
import { HOUSE, ROOMS, FIXTURE_NOW } from '../fixtures/house.js';
import { roomFromCore } from '../house.js';
import type { Devices } from '../devices.js';
import { litRoomPage } from './grouping.js';

const devices: Devices = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
const rooms = ROOMS.map(roomFromCore);
const page = (id: string) =>
	litRoomPage(id, {
		devices,
		rooms,
		added: [],
		pluginCard: () => undefined,
		now: FIXTURE_NOW
	});
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
