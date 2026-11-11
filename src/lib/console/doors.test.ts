import { describe, expect, it } from 'vitest';
import type { CoreDevice, Schema } from '../devices.js';
import { doorName, doorNumber, doorsTab, isOverhead, pressFor } from './doors.js';

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	schema?: Schema
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	available: true,
	attributes,
	...(schema ? { schema } : {})
});
const ids = (list: { device_id: string }[]) => list.map((d) => d.device_id);
const scene: Schema = { attributes: {}, actions: [{ id: 'activate', label: 'Activate' }] };

describe('an overhead door’s number', () => {
	it('reads it from its sensor’s and its opener’s names', () => {
		expect(doorNumber('Garage OH1 Door Sensor')).toBe(1);
		expect(doorNumber('OH Door 02')).toBe(2);
		expect(doorNumber('Garage Door 1')).toBe(1);
		expect(doorNumber('Garage Deck Door Sensor')).toBeUndefined();
		expect(doorNumber('Garage Door')).toBeUndefined();
	});

	it('tells an overhead door’s sensor from a plain door’s', () => {
		expect(isOverhead('Garage OH2 Door Sensor')).toBe(true);
		expect(isOverhead('Overhead door')).toBe(true);
		expect(isOverhead('Garage Deck Door Sensor')).toBe(false);
	});

	it('names the door from its sensor, without the room', () => {
		expect(doorName('Garage OH1 Door Sensor', 'Garage')).toBe('OH1 Door');
	});
});

describe('the Doors tab’s parts', () => {
	const oh1 = dev('Garage OH1 Door Sensor', 'contact_sensor', { open: false });
	const oh2 = dev('Garage OH2 Door Sensor', 'contact_sensor', { open: true });
	const deck = dev('Garage Deck Door Sensor', 'contact_sensor', { open: false });
	const s1 = dev('OH Door 01', 'scene', {}, scene);
	const s1b = dev('Garage Door 1', 'scene', {}, scene);
	const s2 = dev('OH Door 02', 'scene', {}, scene);
	const glue = dev('Garage Door', 'switch', { on: false });
	const lock = dev('Exterior Lock', 'lock', { locked: true });
	const cam = dev('Driveway', 'camera');

	it('pairs each overhead door’s sensor with its openers by number', () => {
		const tab = doorsTab([deck, glue, s1b, s1, s2, oh1, oh2, lock, cam], 'Garage');
		expect(tab.big.map((b) => [b.name, b.sensor?.device_id, b.opener?.device_id])).toEqual([
			['OH1 Door', oh1.device_id, s1b.device_id],
			['OH2 Door', oh2.device_id, s2.device_id]
		]);
		expect(ids(tab.big[0]!.also)).toEqual([s1.device_id]);
		expect(ids(tab.doors)).toEqual([deck.device_id]);
		expect(ids(tab.openers)).toEqual([glue.device_id]);
		expect(ids(tab.locks)).toEqual([lock.device_id]);
		expect(ids(tab.watch)).toEqual([cam.device_id]);
	});

	it('draws a cover that reports where it is as its own door', () => {
		const gd = dev('Shop door', 'garage_door', { open: false });
		const tab = doorsTab([gd]);
		expect(tab.big).toHaveLength(1);
		expect(tab.big[0]).toMatchObject({ sensor: gd, opener: gd });
		expect(tab.watch).toEqual([]);
		expect(tab.openers).toEqual([]);
	});

	it('keeps a door sensor with no opener as a big door when it is an overhead one', () => {
		const tab = doorsTab([oh1]);
		expect(tab.big[0]).toMatchObject({ sensor: oh1 });
		expect(tab.big[0]!.opener).toBeUndefined();
	});
});

describe('pressing a door’s button', () => {
	it('runs a scene, flips a switch, and tells a cover which way', () => {
		expect(pressFor(dev('s', 'scene', {}, scene), false)).toEqual({
			kind: 'action',
			id: 'activate'
		});
		expect(pressFor(dev('s', 'scene'), false)).toBeUndefined();
		expect(pressFor(dev('g', 'switch', { on: false }), undefined)).toEqual({
			kind: 'set',
			want: { on: true }
		});
		const cover = dev(
			'c',
			'garage_door',
			{ open: true },
			{
				attributes: { open: { kind: 'bool', writable: true } }
			}
		);
		expect(pressFor(cover, true)).toEqual({ kind: 'set', want: { open: false } });
		const acts = dev(
			'c',
			'cover',
			{},
			{
				attributes: {},
				actions: [
					{ id: 'open', label: 'Open' },
					{ id: 'close', label: 'Close' }
				]
			}
		);
		expect(pressFor(acts, false)).toEqual({ kind: 'action', id: 'open' });
	});
});
