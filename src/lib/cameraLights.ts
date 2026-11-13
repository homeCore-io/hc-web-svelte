/**
 * A camera's own spotlight: `<camera>_spotlight` (Reolink's floodlight), a
 * light only so it can be switched. It belongs with its camera, wherever each
 * was put, so it is never one of a room's lights: not counted, not drawn as a
 * lamp, and never sent Room on, Room off or "Every light off".
 */
import { kindOf } from './card.js';
import type { CoreDevice, Devices } from './devices.js';

const CAMERAS = new Set(['camera', 'doorbell']);
const SPOTLIGHT = /^(.+)_spotlight$/;

/** Whether a device is a camera or a doorbell with one. */
export const isCamera = (d: CoreDevice): boolean => CAMERAS.has(kindOf(d));

/**
 * The camera a light belongs to, if it is `<camera>_spotlight` for a camera
 * anywhere in `all` (the house's devices, as a map or a list).
 */
export function spotlightCamera(
	d: Pick<CoreDevice, 'device_id'>,
	all: Devices | readonly CoreDevice[]
): string | undefined {
	const m = SPOTLIGHT.exec(d.device_id);
	if (!m) return undefined;
	const id = m[1]!;
	const camera = Array.isArray(all)
		? (all as readonly CoreDevice[]).find((x) => x.device_id === id)
		: (all as Devices)[id];
	return camera && isCamera(camera) ? id : undefined;
}

/** Whether a device is a camera's spotlight (`spotlightCamera`). */
export const isCameraLight = (
	d: Pick<CoreDevice, 'device_id'>,
	all: Devices | readonly CoreDevice[]
): boolean => spotlightCamera(d, all) !== undefined;

/**
 * The lights Room on and Room off reach in a room, as homeCore counts them
 * (`room_lights.rs`): lights and devices hinted as lights, not a group or a
 * scene, and never a camera's spotlight.
 */
export function roomPowerLights(
	list: readonly CoreDevice[],
	all: Devices | readonly CoreDevice[]
): CoreDevice[] {
	return list.filter((d) => {
		const type = d.device_type ?? '';
		if (type === 'group' || type === 'scene') return false;
		if (type !== 'light' && d.ui_hint !== 'light') return false;
		return !isCameraLight(d, all);
	});
}

/** The ids of every camera's spotlight in the house, for what counts lights from cards. */
export function cameraLightIds(all: Devices | readonly CoreDevice[]): Set<string> {
	const list = Array.isArray(all) ? (all as readonly CoreDevice[]) : Object.values(all as Devices);
	return new Set(list.filter((d) => isCameraLight(d, all)).map((d) => d.device_id));
}

/** The same from the house's cards: a spotlight whose camera is among them. */
export function cameraLightCards(cards: readonly { id: string; kind: string }[]): Set<string> {
	const cameras = new Set(cards.filter((c) => CAMERAS.has(c.kind)).map((c) => c.id));
	return new Set(
		cards
			.filter((c) => {
				const m = SPOTLIGHT.exec(c.id);
				return !!m && cameras.has(m[1]!);
			})
			.map((c) => c.id)
	);
}
