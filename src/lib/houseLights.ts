/**
 * The house's lights from its devices, rooms and the household's console
 * choices (its tabs, its drawings' spots): `houseLights` in pictures.ts,
 * loaded by houseNow.svelte.ts after Home's own code.
 */
import type { Devices } from './devices.js';
import type { Room } from './house.js';
import { houseLights } from './console/pictures.js';
import { tabChoicesOf } from './console/room.js';
import { roomIn } from './console/layout.js';

export function houseLightsNow(
	byId: Devices,
	rooms: Room[],
	choices: { tabs?: unknown; rooms?: unknown } | undefined
): ReturnType<typeof houseLights> {
	return houseLights(
		byId,
		rooms,
		tabChoicesOf(choices?.tabs),
		(id) => roomIn(choices?.rooms, id).links
	);
}
