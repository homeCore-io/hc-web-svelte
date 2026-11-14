import { describe, expect, it } from 'vitest';
import { cardFor } from './card.js';
import type { CoreDevice } from './devices.js';
import {
	cameraLightCards,
	cameraLightIds,
	isCameraLight,
	roomPowerLights,
	spotlightCamera
} from './cameraLights.js';
import { allOffTargets, houseChips, roomSummary } from './summary.js';
import { roomBox } from './roomBox.js';
import { ROOM_BUILT_IN, resolve } from './options.js';
import { fromList } from './devices.js';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const dev = (
	id: string,
	device_type: string,
	attributes: Record<string, unknown> = {},
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type,
	available: true,
	attributes,
	...more
});

// The porch has only its cameras' floodlights; the front deck's camera is outside.
const porch = [
	dev('reolink_porch', 'camera'),
	dev('reolink_porch_spotlight', 'light', { on: true, brightness_pct: 100 }),
	dev('reolink_porch_siren', 'siren', { on: false })
];
const outside = [
	dev('reolink_front_deck', 'camera'),
	dev('flood', 'light', { on: true, brightness_pct: 100 })
];
const loose = [dev('reolink_front_deck_spotlight', 'light', { on: true, brightness_pct: 100 })];
const house = fromList([...porch, ...outside, ...loose]);

describe('a camera’s spotlight', () => {
	it('is `<camera>_spotlight` for a camera anywhere in the house', () => {
		expect(spotlightCamera(loose[0]!, house)).toBe('reolink_front_deck');
		expect(isCameraLight(porch[1]!, house)).toBe(true);
		// A light that only looks like one: no camera by that name.
		expect(isCameraLight(dev('desk_spotlight', 'light'), house)).toBe(false);
		expect(isCameraLight(outside[1]!, house)).toBe(false);
		expect([...cameraLightIds(house)].sort()).toEqual([
			'reolink_front_deck_spotlight',
			'reolink_porch_spotlight'
		]);
	});

	it('is never one Room on or Room off reaches', () => {
		expect(roomPowerLights(porch, house)).toEqual([]);
		expect(roomPowerLights(loose, house)).toEqual([]);
		expect(roomPowerLights(outside, house).map((d) => d.device_id)).toEqual(['flood']);
		expect(roomPowerLights([dev('g', 'group'), dev('s', 'scene')], house)).toEqual([]);
	});

	it('is not counted as a light on: not on Home’s chip, a room’s line or its box', () => {
		const cards = Object.values(house).map((d) => cardFor(d, NOW));
		expect([...cameraLightCards(cards)].sort()).toEqual([
			'reolink_front_deck_spotlight',
			'reolink_porch_spotlight'
		]);
		expect(houseChips(cards).find((c) => c.key === 'lights')?.ids).toEqual(['flood']);
		const porchCards = porch.map((d) => cardFor(d, NOW));
		expect(roomSummary(porchCards)).toBe('All quiet');
		const box = roomBox(porch, porchCards, house, resolve([], ROOM_BUILT_IN));
		expect(box.lines.some((l) => l.what === 'lights')).toBe(false);
		expect(box.lights).toBeUndefined();
	});

	it('is never turned off by a room’s All off, so the button never sits beside All quiet', () => {
		// Switchable, as Reolink's are.
		const switchable = (d: CoreDevice): CoreDevice => ({
			...d,
			schema: { attributes: { on: { kind: 'bool', writable: true } } }
		});
		const porchCards = porch.map((d) => cardFor(switchable(d), NOW));
		expect(allOffTargets(porchCards)).toEqual([]);
		expect(allOffTargets(porchCards, house)).toEqual([]);
		// Its camera is in another room: the house tells it.
		const looseCards = loose.map((d) => cardFor(switchable(d), NOW));
		expect(allOffTargets(looseCards, house)).toEqual([]);
		const outsideCards = outside.map((d) => cardFor(switchable(d), NOW));
		expect(allOffTargets(outsideCards, house).map((c) => c.id)).toEqual(['flood']);
		const box = roomBox(porch, porchCards, house, resolve([], ROOM_BUILT_IN));
		expect(box.allOff).toEqual([]);
	});
});
