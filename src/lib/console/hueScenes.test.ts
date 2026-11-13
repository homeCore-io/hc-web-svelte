import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import {
	appliesTo,
	lampSceneNote,
	onLabel,
	onScene,
	sceneHas,
	sceneIdOf,
	sceneLights,
	sceneNameOf,
	swatchOf,
	takesScenes
} from './hueScenes.js';

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	plugin_id: 'plugin.hue',
	available: true,
	attributes,
	...more
});
const applies = { actions: [{ id: 'apply_scene', label: 'Apply scene' }] } as CoreDevice['schema'];
const lamp = (id: string, attributes: Record<string, unknown> = {}, takes = true) =>
	dev(id, 'light', attributes, takes ? { schema: applies } : {});
const relax = dev('scene_relax', 'scene', {
	lights: [
		{ device_id: 'floor', on: true, brightness_pct: 40, color_hex: '#FFB46B' },
		{ device_id: 'small', on: true, color_temp: 2700, color_hex: 'ffd9a0' },
		{ device_id: 'arch', on: false, color_hex: '#000000' }
	]
});
const smart = dev('scene_smart', 'scene', { active: true });

describe('sceneLights and sceneHas', () => {
	it('reads the lamps a scene sets, and none for a smart scene', () => {
		expect(sceneLights(relax).map((l) => l.device_id)).toEqual(['floor', 'small', 'arch']);
		expect(sceneLights(smart)).toEqual([]);
		expect(sceneLights(dev('odd', 'scene', { lights: [null, 3, { on: true }] }))).toEqual([]);
		expect(sceneHas(relax, 'floor')).toBe(true);
		expect(sceneHas(relax, 'desk')).toBe(false);
		expect(sceneHas(smart, 'floor')).toBe(false);
	});
});

describe('appliesTo', () => {
	it('needs the lamp to declare apply_scene and the scene to set it', () => {
		expect(takesScenes(lamp('floor'))).toBe(true);
		expect(takesScenes(lamp('floor', {}, false))).toBe(false);
		expect(appliesTo(relax, lamp('floor'))).toBe(true);
		expect(appliesTo(relax, lamp('floor', {}, false))).toBe(false);
		expect(appliesTo(relax, lamp('desk'))).toBe(false);
		expect(appliesTo(smart, lamp('floor'))).toBe(false);
	});
});

describe('the scene that is on', () => {
	const scenes = [relax, smart];
	it('is the one the target reports, else for a group the active one', () => {
		const group = dev('room', 'light', { scene: 'scene_relax', scene_name: 'Relax' });
		expect(onScene(scenes, group)?.device_id).toBe('scene_relax');
		expect(onScene(scenes, dev('room', 'light', { scene: null }))?.device_id).toBe('scene_smart');
		expect(onScene(scenes, undefined)?.device_id).toBe('scene_smart');
	});
	it('is none for a lamp that reports none', () => {
		expect(onScene(scenes, lamp('floor', { scene: null }), true)).toBeUndefined();
		expect(onScene(scenes, lamp('floor', { scene: 'scene_relax' }), true)?.device_id).toBe(
			'scene_relax'
		);
	});
	it('reads scene and scene_name, empty or null as none', () => {
		expect(sceneIdOf(dev('g', 'light', { scene: '' }))).toBeUndefined();
		expect(sceneNameOf(dev('g', 'light', { scene_name: null }))).toBeUndefined();
		expect(sceneNameOf(dev('g', 'light', { scene_name: ' ' }))).toBeUndefined();
		expect(sceneNameOf(dev('g', 'light', { scene_name: 'Relax' }))).toBe('Relax');
	});
});

describe('onLabel', () => {
	it('names the group’s scene, else the active chip, else none', () => {
		expect(onLabel(dev('g', 'light', { scene_name: 'Relax' }), 'Bright')).toBe('Relax is on');
		expect(onLabel(dev('g', 'light', { scene_name: null }), 'Bright')).toBe('Bright is on');
		expect(onLabel(undefined, undefined)).toBe('none on');
	});
});

describe('lampSceneNote', () => {
	const group = dev('g', 'light', { scene: 'scene_relax', scene_name: 'Relax' });
	it('shows a lamp’s scene only when it isn’t the group’s', () => {
		expect(lampSceneNote(lamp('floor', { scene_name: 'Relax' }), group)).toBeUndefined();
		expect(lampSceneNote(lamp('floor', { scene_name: 'Read' }), group)).toBe('Read');
		expect(lampSceneNote(lamp('floor', { scene_name: 'Read' }), undefined)).toBe('Read');
		expect(lampSceneNote(lamp('floor', { scene_name: null }), group)).toBeUndefined();
	});
});

describe('swatchOf', () => {
	it('blends the colours of the lamps the scene lights', () => {
		expect(swatchOf(relax)).toBe('linear-gradient(135deg, #ffb46b, #ffd9a0)');
	});
	it('is one colour for one lamp, or the same colour twice', () => {
		const one = dev('s', 'scene', {
			lights: [
				{ device_id: 'a', on: true, color_hex: '#336699' },
				{ device_id: 'b', on: true, color_hex: '#336699' }
			]
		});
		expect(swatchOf(one)).toBe('#336699');
	});
	it('falls back to the palette, then a warm white', () => {
		expect(swatchOf(dev('s', 'scene', { palette: ['#111111', '#222222'] }))).toBe(
			'linear-gradient(135deg, #111111, #222222)'
		);
		expect(swatchOf(dev('s', 'scene', { lights: [{ device_id: 'a', on: true }] }))).toMatch(
			/^radial-gradient/
		);
		expect(swatchOf(smart)).toMatch(/^radial-gradient/);
	});
});
