/**
 * A Hue room's scenes on the Lights tab, as plain data: which lamps a scene
 * sets (its `lights`), whether one lamp can take its part of a scene alone
 * (`apply_scene`), the scene a group or a lamp is showing (`scene`,
 * `scene_name`), and a chip's swatch from the scene's own colours.
 */
import type { CoreDevice } from '../devices.js';

/** One lamp's part of a scene, as the bridge keeps it. */
export interface SceneLight {
	device_id: string;
	on: boolean;
	brightness_pct?: number;
	/** Kelvin. */
	color_temp?: number;
	color_hex?: string;
}

/** The lamps a scene sets; none for a smart scene, which keeps no list. */
export function sceneLights(scene: CoreDevice): SceneLight[] {
	const raw = scene.attributes?.lights;
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(l): l is SceneLight =>
			!!l && typeof l === 'object' && typeof (l as SceneLight).device_id === 'string'
	);
}

/** Whether the scene sets this lamp. */
export const sceneHas = (scene: CoreDevice, lampId: string): boolean =>
	sceneLights(scene).some((l) => l.device_id === lampId);

/** Whether the lamp's plugin lets it take its part of a scene alone. */
export const takesScenes = (lamp: CoreDevice): boolean =>
	!!lamp.schema?.actions?.some((a) => a.id === 'apply_scene');

/** Whether a chip can show the scene in this one lamp. */
export const appliesTo = (scene: CoreDevice, lamp: CoreDevice): boolean =>
	takesScenes(lamp) && sceneHas(scene, lamp.device_id);

/** The scene a group or a lamp is showing, as the bridge names it; none when no scene matches. */
export function sceneNameOf(d: CoreDevice | undefined): string | undefined {
	const n = d?.attributes?.scene_name;
	return typeof n === 'string' && n.trim() !== '' ? n : undefined;
}

/** The scene's device id a group or a lamp is showing. */
export function sceneIdOf(d: CoreDevice | undefined): string | undefined {
	const s = d?.attributes?.scene;
	return typeof s === 'string' && s !== '' ? s : undefined;
}

/**
 * The chip that is on: the one the target (a lamp, else the group) reports
 * showing, else, for the group, the scene that says it is active.
 */
export function onScene(
	scenes: CoreDevice[],
	target: CoreDevice | undefined,
	lamp = false
): CoreDevice | undefined {
	const id = sceneIdOf(target);
	if (id) return scenes.find((s) => s.device_id === id);
	if (lamp) return undefined;
	return scenes.find((s) => s.attributes.active === true);
}

/**
 * What the scenes line says is on: the group's `scene_name`, else the active
 * chip's name; none when neither says.
 */
export function onLabel(group: CoreDevice | undefined, active: string | undefined): string {
	const n = sceneNameOf(group) ?? active;
	return n ? `${n} is on` : 'none on';
}

/** A lamp's own scene, shown under its name only when it isn't the group's. */
export function lampSceneNote(lamp: CoreDevice, group: CoreDevice | undefined): string | undefined {
	const n = sceneNameOf(lamp);
	if (!n) return undefined;
	return n === sceneNameOf(group) ? undefined : n;
}

const HEX = /^#?[0-9a-f]{6}$/i;
const WARM = 'radial-gradient(circle at 35% 30%, #fff3e0, #f7b979)';

/**
 * A chip's swatch: the lamps' colours in the scene (`color_hex`), else the
 * scene's palette, else a warm white.
 */
export function swatchOf(scene: CoreDevice): string {
	const fromLights = sceneLights(scene)
		.filter((l) => l.on !== false && typeof l.color_hex === 'string' && HEX.test(l.color_hex))
		.map((l) => (l.color_hex!.startsWith('#') ? l.color_hex! : `#${l.color_hex}`).toLowerCase());
	const palette = Array.isArray(scene.attributes.palette)
		? (scene.attributes.palette as unknown[]).filter((x): x is string => typeof x === 'string')
		: [];
	const p = fromLights.length > 0 ? [...new Set(fromLights)] : palette;
	return p.length > 1 ? `linear-gradient(135deg, ${p.slice(0, 4).join(', ')})` : (p[0] ?? WARM);
}
