/**
 * A room's lights as the Lights tab works them, on the desktop (LightsTab)
 * and the phone (phone/PhoneLights, phone/LampSheet): each light's level
 * and whether it's on, with commands on their way; a group's "All"; and
 * its scenes, shown in the whole group or, where the scene sets the lamp
 * and its plugin can (`apply_scene`), in one lamp only (hueScenes.ts).
 */
import type { CoreDevice } from '#lib/devices.js';
import { commands } from '#lib/commands.svelte.js';
import { colourOf } from '#lib/lit/room.js';
import { levelOf, levelWant, type LightColumn } from './room.js';
import { onScene } from './hueScenes.js';

export const wantOf = (d: CoreDevice) => commands.pending[d.device_id]?.want;
/** A command is on its way to it. */
export const waiting = (d: CoreDevice): boolean => commands.pending[d.device_id] !== undefined;
export const level = (d: CoreDevice): number => levelOf(d, wantOf(d));
export const isOn = (d: CoreDevice): boolean => ({ ...d.attributes, ...wantOf(d) }).on === true;
/** The light's own color while it's on, as CSS. */
export const colour = (d: CoreDevice): string | undefined =>
	isOn(d) ? `rgb(${colourOf(d)})` : undefined;

export function setLevel(d: CoreDevice, v: number): void {
	void commands.set(d.device_id, 'light', levelWant(v), d.attributes);
}
export function setOn(d: CoreDevice, on: boolean): void {
	void commands.set(d.device_id, 'switch', { on }, d.attributes);
}

/** A column's "All": its group's own level, else the brightest of its lamps. */
export const allLevel = (c: LightColumn): number =>
	c.group ? level(c.group) : Math.max(0, ...c.lights.map(level));
export function setAll(c: LightColumn, v: number): void {
	if (c.group) return setLevel(c.group, v);
	for (const l of c.lights) setLevel(l, v);
}

/** The chip that is on: the picked lamp's scene, else the group's. */
export const activeIn = (c: LightColumn, lamp?: CoreDevice): CoreDevice | undefined =>
	lamp ? onScene(c.scenes, lamp, true) : onScene(c.scenes, c.group);
/** Shows a scene where it belongs: its whole group. */
export const show = (s: CoreDevice): void => void commands.act(s.device_id, 'activate');
/** Only the lamp's part of the scene, waited for until the lamp reports showing it. */
export const showIn = (l: CoreDevice, s: CoreDevice): void =>
	void commands.actFor(
		l.device_id,
		'light',
		'apply_scene',
		{ scene_id: s.device_id },
		{ scene: s.device_id },
		l.attributes
	);
/** Whether that scene is on its way to the lamp. */
export const sending = (l: CoreDevice | undefined, s: CoreDevice): boolean =>
	!!l && commands.pending[l.device_id]?.want.scene === s.device_id;
/** What went wrong with the column's last command, if anything did. */
export const noteOf = (c: LightColumn): string | undefined =>
	[c.group, ...c.lights].map((d) => d && commands.notes[d.device_id]).find((n) => !!n);
