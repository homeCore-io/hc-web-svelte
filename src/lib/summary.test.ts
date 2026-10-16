import { describe, expect, it } from 'vitest';
import { cardFor } from './card.js';
import { roomFromCore } from './house.js';
import { HOUSE, ROOMS, FIXTURE_NOW } from './fixtures/house.js';
import { allOffTargets, byRoom, houseChips, roomSections, roomSummary, slugOf } from './summary.js';
import { fromList } from './devices.js';

const rooms = ROOMS.map(roomFromCore);
const grouped = byRoom(fromList(HOUSE), rooms);
const cardsIn = (roomId: string) => (grouped.get(roomId) ?? []).map((d) => cardFor(d, FIXTURE_NOW));
const all = HOUSE.map((d) => cardFor(d, FIXTURE_NOW));

describe('the house chips', () => {
	it('lead with what needs attention, then what is on', () => {
		expect(houseChips(all).map((c) => c.text)).toEqual([
			'1 leak',
			'1 open',
			'1 light on',
			'Den TV playing'
		]);
		expect(houseChips(all)[0]).toMatchObject({ alert: true, ids: ['yolink_leak_2'] });
	});

	it('say nothing when nothing is going on', () => {
		const quiet = HOUSE.filter((d) => d.device_type === 'temperature_sensor').map((d) =>
			cardFor(d, FIXTURE_NOW)
		);
		expect(houseChips(quiet)).toEqual([]);
	});
});

describe('rooms', () => {
	it('devices find their room by slug or by an alias a rename left', () => {
		const tvRoom = { ...HOUSE[0]!, device_id: 'old', area: 'tv_room' };
		const g = byRoom(fromList([tvRoom]), rooms);
		expect(g.get('r-den')?.map((d) => d.device_id)).toEqual(['old']);
	});

	it('a room-less device is grouped under no room', () => {
		expect(
			grouped
				.get('')
				?.map((d) => d.device_id)
				.sort()
		).toEqual(['caseta_scene_goodnight', 'mode_night']);
	});

	it('a room’s summary: lights, temperature, anything playing', () => {
		expect(roomSummary(cardsIn('r-den'))).toBe('1 light on · 1 fan on · 70.5°F · Den TV playing');
		expect(roomSummary(cardsIn('r-kitchen'))).toBe('Back door open');
		expect(roomSummary(cardsIn('r-garage'))).toBe('Leak · 1 switch on');
		expect(roomSummary(cardsIn('r-bedroom'))).toBe('All quiet');
	});

	it('never offers "All off" beside a summary that says nothing is on', () => {
		for (const r of rooms) {
			const cards = cardsIn(r.id);
			if (allOffTargets(cards).length > 0) expect(roomSummary(cards), r.name).not.toBe('All quiet');
		}
	});

	it('"All off" covers lights, switches, fans and players that are on — never locks', () => {
		expect(
			allOffTargets(cardsIn('r-den'))
				.map((c) => c.id)
				.sort()
		).toEqual(['hue_lamp', 'lutron_fan', 'roku_den']);
		expect(allOffTargets(cardsIn('r-hall'))).toEqual([]);
	});

	it('a room page: controls, scenes, sensors, then the rest', () => {
		const sections = roomSections(cardsIn('r-den'));
		expect(sections.map((s) => s.key)).toEqual(['controls', 'scenes', 'sensors']);
		expect(sections[0]!.cards.map((c) => c.name)).toEqual([
			'Ceiling',
			'Ceiling fan',
			'Den TV',
			'Reading lamp'
		]);
	});

	it('slugs match homeCore’s', () => {
		expect(slugOf("Kid's Room")).toBe('kid_s_room');
		expect(slugOf('  TV Room ')).toBe('tv_room');
	});
});
