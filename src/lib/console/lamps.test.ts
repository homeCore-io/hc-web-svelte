import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDevice } from '../devices.js';
import type { LightColumn } from './room.js';

// The commands on their way, and what was sent: a stand-in for the app's.
const sent = vi.hoisted(() => ({
	pending: {} as Record<string, { want: Record<string, unknown> }>,
	notes: {} as Record<string, string>,
	set: vi.fn(),
	act: vi.fn(),
	actFor: vi.fn()
}));
vi.mock('#lib/commands.svelte.js', () => ({ commands: sent }));

const { activeIn, allLevel, isOn, level, noteOf, sending, setAll, show, showIn } =
	await import('./lamps.js');

const lamp = (device_id: string, attributes: Record<string, unknown> = {}): CoreDevice => ({
	device_id,
	name: device_id,
	device_type: 'light',
	plugin_id: 'plugin.hue',
	available: true,
	attributes
});
const column = (lights: CoreDevice[], more: Partial<LightColumn> = {}): LightColumn => ({
	key: 'k',
	brand: 'Hue',
	plugin: 'plugin.hue',
	title: 'Office',
	lights,
	scenes: [],
	...more
});

beforeEach(() => {
	sent.pending = {};
	sent.notes = {};
	vi.clearAllMocks();
});

describe('a light on the Lights tab', () => {
	it('is on at its level, with a command on its way taken as done', () => {
		const l = lamp('a', { on: true, brightness_pct: 40 });
		expect([isOn(l), level(l)]).toEqual([true, 40]);
		sent.pending.a = { want: { on: false } };
		expect([isOn(l), level(l)]).toEqual([false, 0]);
	});
});

describe('a column’s All', () => {
	const a = lamp('a', { on: true, brightness_pct: 30 });
	const b = lamp('b', { on: true, brightness_pct: 70 });
	const off = lamp('c', { on: false });

	it('is the group’s own level, else the brightest lamp’s, else 0', () => {
		const group = lamp('g', { on: true, brightness_pct: 55 });
		expect(allLevel(column([a, b], { group }))).toBe(55);
		expect(allLevel(column([a, b, off]))).toBe(70);
		expect(allLevel(column([off]))).toBe(0);
		expect(allLevel(column([]))).toBe(0);
	});

	it('sets the group once where there is one, else each lamp', () => {
		const group = lamp('g', { on: false });
		setAll(column([a, b], { group }), 80);
		expect(sent.set).toHaveBeenCalledTimes(1);
		expect(sent.set).toHaveBeenCalledWith(
			'g',
			'light',
			{ on: true, brightness_pct: 80 },
			{
				on: false
			}
		);
		sent.set.mockClear();
		setAll(column([a, b]), 0);
		expect(sent.set.mock.calls.map((c) => [c[0], c[2]])).toEqual([
			['a', { on: false }],
			['b', { on: false }]
		]);
	});
});

describe('a column’s scenes', () => {
	const bright = lamp('scene_bright', { active: true });
	const read = lamp('scene_read', { active: false });

	it('the one on: the picked lamp’s, else the group’s, else the active one', () => {
		const group = lamp('g', { scene: 'scene_read' });
		const c = column([], { scenes: [bright, read], group });
		expect(activeIn(c)?.device_id).toBe('scene_read');
		expect(activeIn(column([], { scenes: [bright, read] }))?.device_id).toBe('scene_bright');
		// A lamp says only its own: none, until it reports one.
		expect(activeIn(c, lamp('l'))).toBeUndefined();
		expect(activeIn(c, lamp('l', { scene: 'scene_bright' }))?.device_id).toBe('scene_bright');
	});

	it('shows a scene in its group, or in one lamp, waiting for that lamp', () => {
		show(read);
		expect(sent.act).toHaveBeenCalledWith('scene_read', 'activate');
		const l = lamp('l', { on: true });
		showIn(l, read);
		expect(sent.actFor).toHaveBeenCalledWith(
			'l',
			'light',
			'apply_scene',
			{ scene_id: 'scene_read' },
			{ scene: 'scene_read' },
			{ on: true }
		);
		expect(sending(l, read)).toBe(false);
		sent.pending.l = { want: { scene: 'scene_read' } };
		expect(sending(l, read)).toBe(true);
		expect(sending(undefined, read)).toBe(false);
	});

	it('says what went wrong with the column’s last command', () => {
		const c = column([lamp('a'), lamp('b')], { group: lamp('g') });
		expect(noteOf(c)).toBeUndefined();
		sent.notes.b = 'Didn’t answer';
		expect(noteOf(c)).toBe('Didn’t answer');
	});
});
