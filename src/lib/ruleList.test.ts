import { describe, expect, test } from 'vitest';
import { DEVICES, RULES } from './fixtures/rules.js';
import {
	commonName,
	counts,
	familiesOf,
	familyKey,
	groupsOf,
	houseOf,
	likelyFor,
	nameKey,
	onlyTells,
	repoint,
	rowsOf,
	shows,
	whenText
} from './ruleList.js';
import type { Rule } from './ruleWords.js';

const byId = Object.fromEntries(DEVICES.map((d) => [d.device_id, d]));
const h = houseOf(byId);
const rows = rowsOf(
	RULES,
	h,
	{ 'r-door': { ran: '2026-10-16T10:00:00Z', failed: 'timeout' } },
	{ 'r-dry': 'Dry' }
);
const row = (id: string) => rows.find((r) => r.rule.id === id)!;

describe('families (E4)', () => {
	test('names alike but for a number, on/off or time of day', () => {
		expect(familyKey('Keypad lutron_72 Btn1 - Living Room On')).toBe(
			'keypad lutron_# btn# - living room'
		);
		expect(familyKey('LED sync - Btn3 LED off (Floor Lamp off)')).toBe('led sync - btn# led');
		expect(familyKey('OH1 Timer Close (Day)')).toBe(familyKey('OH1 Timer Close - Night'));
		expect(familyKey('Garage Lights Off - Timer Finished')).not.toBe(
			familyKey('Deck Lights Off - Timer Finished')
		);
	});

	test('found, and named by what they share', () => {
		const f = familiesOf(RULES);
		expect(f.get('r-btn-on')?.ids).toEqual(['r-btn-on', 'r-btn-off']);
		expect(f.get('r-btn-on')?.label).toBe('Keypad Btn1 - Den');
		expect(f.get('r-music-am')?.label).toBe('Den - Music on Close');
		expect(f.get('r-start-1')?.label).toBe('When homeCore starts');
		expect(f.has('r-door')).toBe(false);
	});

	test('the shared part ends on a whole word', () => {
		expect(commonName(['Office Humidifier On', 'Office Humidifier Off'])).toBe('Office Humidifier');
		expect(commonName(['OH1 Opened', 'OH1 Opened - Night'])).toBe('OH1 Opened');
	});
});

describe('the list', () => {
	test('trouble: homeCore’s error, a missing device, a failed step', () => {
		expect(row('r-gone').trouble).toEqual([
			"homeCore can’t run it: device reference 'zz_old_lamp' did not match any known device",
			'Names “zz_old_lamp”, which the house has no device for'
		]);
		expect(row('r-door').trouble).toEqual(['A step failed when it last ran: timeout']);
		expect(row('r-btn-on').trouble).toEqual([]);
	});

	test('search finds rules by the devices they name', () => {
		expect(rows.filter((r) => shows(r, 'corner', 'all')).map((r) => r.rule.id)).toEqual([
			'r-btn-on',
			'r-btn-off',
			'r-night'
		]);
		expect(rows.filter((r) => shows(r, 'porch door', 'all')).length).toBe(4);
	});

	test('chips count what the search leaves', () => {
		expect(counts(rows, '')).toEqual({ all: 10, attention: 2, off: 2, families: 6 });
		expect(counts(rows, 'pantry').attention).toBe(1);
	});

	test('by tag, rooms first, a family in one place, untagged last', () => {
		const g = groupsOf(rows, ['Den']);
		expect(g.map((x) => `${x.title} ${x.count}`)).toEqual([
			'Den 5',
			'Pantry 2',
			'Startup 1',
			'Not tagged 3'
		]);
		expect(g[0]!.items.map((i) => ('row' in i ? i.row.rule.id : i.family.label))).toEqual([
			'Den - Music on Close',
			'r-dry',
			'Keypad Btn1 - Den'
		]);
	});

	test('a mode’s rules and message-only rules are known', () => {
		expect(row('r-dry').byMode).toBe('Dry');
		expect(onlyTells(RULES.find((r) => r.id === 'r-start-1')!)).toBe(true);
		expect(onlyTells(RULES.find((r) => r.id === 'r-door')!)).toBe(false);
	});
});

describe('names homeCore resolves', () => {
	test('by id, name in rules, or a name only one device has', () => {
		expect(h.device('zz_door_1')?.name).toBe('Pantry Door');
		expect(h.device('pantry.pantry_door')?.name).toBe('Pantry Door');
		expect(h.device('Corner Lamp')?.device_id).toBe('zz_lamp_2');
		expect(nameKey('Living Room — Lamp!')).toBe('living_room_lamp');
	});

	test('a name two devices share resolves to neither', () => {
		const twins = houseOf({
			a: { ...byId.zz_lamp_1!, device_id: 'a', name: 'Lamp' },
			b: { ...byId.zz_lamp_2!, device_id: 'b', name: 'Lamp' }
		});
		expect(twins.device('lamp')).toBeUndefined();
	});

	test('the device a missing one probably was', () => {
		expect(likelyFor('den', byId)?.device_id).toBe('zz_speaker_den');
		expect(likelyFor('DELETED:fan_timer', byId)).toBeUndefined();
		expect(likelyFor('den_fan', byId)?.device_id).toBe('timer_den_fan');
	});

	test('repointing changes fields and scripts, nothing else', () => {
		const r = RULES.find((x) => x.id === 'r-night')!;
		const next = repoint(r, 'mode_night', 'mode_evening') as Rule;
		expect(JSON.stringify(next)).toContain('device_state(\\"mode_evening\\")');
		expect(next.name).toBe(r.name);
		const moved = repoint(
			RULES.find((x) => x.id === 'r-btn-on')!,
			'zz_lamp_1',
			'zz_lamp_9'
		);
		expect(JSON.stringify(moved).match(/zz_lamp_9/g)?.length).toBe(2);
	});
});

test('when it ran, as the list says it', () => {
	const now = Date.parse('2026-10-16T15:00:00');
	expect(whenText(new Date(now - 30_000).toISOString(), now)).toBe('just now');
	expect(whenText(new Date(now - 12 * 60_000).toISOString(), now)).toBe('12 min ago');
	expect(whenText(new Date(Date.parse('2026-10-16T08:49:00')).toISOString(), now)).toBe(
		'today 08:49'
	);
	expect(whenText(new Date(Date.parse('2026-10-15T22:10:00')).toISOString(), now)).toBe(
		'yesterday 22:10'
	);
	expect(whenText(undefined, now)).toBe('');
});
