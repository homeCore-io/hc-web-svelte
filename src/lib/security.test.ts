import { describe, expect, it } from 'vitest';
import type { CoreDevice } from './devices.js';
import { cardFor } from './card.js';
import {
	cardOpen,
	cardSecurity,
	cardUnlocked,
	openWords,
	securityKind,
	watchActive,
	watchWord
} from './security.js';

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	plugin_id: 'plugin.test',
	available: true,
	attributes,
	...more
});

describe('how a device counts for security', () => {
	it('goes by its type when nobody chose', () => {
		expect(securityKind(dev('k', 'lock'))).toBe('lock');
		expect(securityKind(dev('d', 'contact_sensor'))).toBe('door');
		expect(securityKind(dev('w', 'window'))).toBe('door');
		expect(securityKind(dev('g', 'garage'))).toBe('door');
		expect(securityKind(dev('m', 'motion_sensor'))).toBeUndefined();
		expect(securityKind(dev('l', 'light'))).toBeUndefined();
	});

	it('puts in what was chosen in, watched when it is no lock or door', () => {
		expect(securityKind(dev('m', 'motion_sensor', {}, { security: true }))).toBe('watch');
		expect(securityKind(dev('l', 'light', {}, { security: true }))).toBe('watch');
		// A lock chosen in is still a lock.
		expect(securityKind(dev('k', 'lock', {}, { security: true }))).toBe('lock');
		expect(securityKind(dev('d', 'door', {}, { security: true }))).toBe('door');
	});

	it('leaves out what was chosen out, whatever its type', () => {
		expect(securityKind(dev('k', 'lock', {}, { security: false }))).toBeUndefined();
		expect(securityKind(dev('d', 'contact_sensor', {}, { security: false }))).toBeUndefined();
		expect(securityKind(dev('m', 'motion_sensor', {}, { security: false }))).toBeUndefined();
	});
});

describe('a watched device', () => {
	it('needs a look while it is active', () => {
		expect(watchActive(dev('m', 'motion_sensor', { motion: true }))).toBe(true);
		expect(watchActive(dev('m', 'motion_sensor', { motion: false }))).toBe(false);
		expect(watchActive(dev('o', 'occupancy_sensor', { occupied: true }))).toBe(true);
		expect(watchActive(dev('p', 'presence', { presence: true }))).toBe(true);
		expect(watchActive(dev('w', 'water_sensor', { water_detected: true }))).toBe(true);
		expect(watchActive(dev('w', 'water_sensor', { water_detected: false }))).toBe(false);
		expect(watchActive(dev('l', 'light', { on: true }))).toBe(true);
		expect(watchActive(dev('l', 'light', { on: false }))).toBe(false);
		expect(watchActive(dev('s', 'switch', { on: true }))).toBe(true);
	});

	it('reads a contact as open when the contact is broken', () => {
		expect(watchActive(dev('c', 'gate_contact', { contact: false }))).toBe(true);
		expect(watchActive(dev('c', 'gate_contact', { contact: true }))).toBe(false);
		expect(watchActive(dev('c', 'gate_contact', { open: true }))).toBe(true);
	});

	it('else goes by its first yes-or-no reading, its primary first', () => {
		const schema = {
			primary: ['tripped'],
			attributes: {
				armed: { kind: 'bool' as const },
				tripped: { kind: 'bool' as const }
			}
		};
		expect(watchActive(dev('x', 'thing', { armed: false, tripped: true }, { schema }))).toBe(true);
		expect(watchActive(dev('x', 'thing', { armed: true, tripped: false }, { schema }))).toBe(false);
		expect(watchActive(dev('x', 'thing', { level: 4 }))).toBe(false);
	});

	it('says its state as its card does', () => {
		expect(watchWord(dev('m', 'motion_sensor', { motion: true }), 0)).toBe('Motion');
		expect(watchWord(dev('l', 'light', { on: false }), 0)).toBe('Off');
		expect(watchWord(dev('l', 'light', { on: true, brightness_pct: 40 }), 0)).toBe('On');
		expect(watchWord(dev('w', 'water_sensor', { water_detected: true }), 0)).toBe('Wet');
	});
});

describe('as cards', () => {
	const door = dev('d', 'contact_sensor', { open: true }, { name: 'Pantry Door' });
	const out = { ...door, device_id: 'o', security: false };
	const motion = dev(
		'm',
		'motion_sensor',
		{ motion: true },
		{ name: 'Driveway Motion', security: true }
	);
	const lock = dev('k', 'lock', { locked: false }, { security: false });
	const byId = { d: door, o: out, m: motion, k: lock };
	const card = (d: CoreDevice) => cardFor(d, 0);

	it('finds what needs a look as an open door does', () => {
		expect(cardSecurity(card(motion), byId)).toBe('watch');
		expect(cardOpen(card(door), byId)).toBe(true);
		expect(cardOpen(card(out), byId)).toBe(false);
		expect(cardOpen(card(motion), byId)).toBe(true);
		expect(cardOpen(card({ ...motion, available: false }), byId)).toBe(false);
		// Without its device at hand, a card goes by its kind.
		expect(cardOpen(card(door))).toBe(true);
		expect(cardOpen(card(motion))).toBe(false);
		expect(cardUnlocked(card(lock), byId)).toBe(false);
		expect(cardUnlocked(card(lock))).toBe(true);
	});

	it('says it in words', () => {
		expect(openWords([card(door)], byId)).toBe('Pantry Door open');
		expect(openWords([card(motion)], byId)).toBe('Driveway Motion: Motion');
		expect(openWords([card(door), card(door)], byId)).toBe('2 open');
		expect(openWords([card(door), card(motion)], byId)).toBe('2 to check');
		expect(openWords([], byId)).toBeUndefined();
	});
});
