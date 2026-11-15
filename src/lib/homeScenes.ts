/**
 * Home's scenes row: the scenes the house chose to show on Home, or the ones
 * a person chose for themselves, which win for them. Kept in the household's
 * and the person's documents (`home.scenes`, layers.ts) as refs, so homeCore's
 * own scenes (`scene:{id}`) and plugins' (`device:{id}`) stay apart.
 *
 * Also what a scene can say about itself, for the row and Settings › Scenes:
 * who provides it, and whether it is active, where it can tell.
 */
import { kindOf } from './card.js';
import { displayName, type CoreDevice, type Devices } from './devices.js';
import { pluginLabel } from './inventory.js';
import { roomOf } from './summary.js';
import type { HouseDoc, PersonDoc } from './layers.js';
import type { Room } from './house.js';
import type { CoreScene } from './scenes.svelte.js';

/** The row's refs, and whether they are the person's own (else the house's). */
export function homeSceneRefs(
	house: HouseDoc | undefined,
	mine: PersonDoc | undefined
): { refs: string[]; own: boolean } {
	const own = mine?.home?.scenes ?? [];
	return own.length > 0
		? { refs: own, own: true }
		: { refs: house?.home?.scenes ?? [], own: false };
}

/** A document with its scenes row set; `undefined` or empty takes it away. */
export function withHomeScenes<D extends HouseDoc | PersonDoc>(
	doc: D,
	refs: string[] | undefined
): D {
	const { scenes: _drop, ...rest } = doc.home ?? {};
	const list = [...new Set(refs ?? [])];
	const home = list.length > 0 ? { ...rest, scenes: list } : rest;
	const { home: _old, ...out } = doc;
	return (Object.keys(home).length > 0 ? { ...out, home } : out) as D;
}

/** Whether a plugin's scene says when it is active: Hue's `active`, a Lutron button's LED (`on`). */
export function sceneTells(d: CoreDevice): boolean {
	if (typeof d.attributes.active === 'boolean') return true;
	return isLutron(d) && typeof d.attributes.on === 'boolean';
}

/** Whether a plugin's scene says it is active now. */
export const sceneActive = (d: CoreDevice): boolean =>
	d.attributes.active === true || (isLutron(d) && d.attributes.on === true);

const isLutron = (d: CoreDevice) => d.plugin_id?.split('.').pop() === 'lutron';

/** Whether a plugin's scene is one of a Hue room's or zone's. */
export const isHueScene = (d: CoreDevice): boolean => d.attributes.kind === 'hue_scene';

/** One button in the row. */
export interface HomeScene {
	ref: string;
	name: string;
	/** A plugin's scene's device; none for homeCore's own. */
	device?: CoreDevice;
	scene?: CoreScene;
	/** It says when it is active, and is now. */
	active: boolean;
	/** Under its name: Active, its room, or who provides it. */
	sub: string;
}

/** The row's buttons, in its order; refs to scenes that are gone are skipped. */
export function homeScenesOf(
	refs: string[],
	devices: Devices,
	scenes: CoreScene[],
	rooms: Room[]
): HomeScene[] {
	const out: HomeScene[] = [];
	for (const r of refs) {
		if (r.startsWith('scene:')) {
			const scene = scenes.find((s) => s.id === r.slice(6));
			if (scene) out.push({ ref: r, name: scene.name, scene, active: false, sub: 'homeCore' });
		} else if (r.startsWith('device:')) {
			const device = devices[r.slice(7)];
			if (!device || kindOf(device) !== 'scene') continue;
			const active = sceneTells(device) && sceneActive(device);
			out.push({
				ref: r,
				name: displayName(device),
				device,
				active,
				sub: active ? 'Active' : (roomOf(device, rooms)?.name ?? pluginLabel(device.plugin_id))
			});
		}
	}
	return out;
}
