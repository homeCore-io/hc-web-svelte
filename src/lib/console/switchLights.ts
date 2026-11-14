/**
 * Turning a room's lights on or off, and every light in the house off, the
 * same way from Home and from Everywhere › Lights: Room on or Room off for a
 * room (homeCore remembers which lights were on), then its own command for
 * each light Room off doesn't cover (a switch named as a light), and for
 * each light in no room, which has no Room on.
 */
import { roomPower } from '#lib/admin.js';
import { commands } from '#lib/commands.svelte.js';
import { devices } from '#lib/devices.svelte.js';
import { kindOf } from '#lib/card.js';
import type { CoreDevice } from '#lib/devices.js';
import type { Room } from '#lib/house.js';
import { isLit } from '#lib/lights.js';

/** A room's lights, or the lights in no room (`room` missing). */
export interface Lights {
	room?: Room;
	name: string;
	lights: CoreDevice[];
}

/** One room's lights on or off; what went wrong, if anything did, in words. */
export async function setLights(r: Lights, on: boolean): Promise<string | null> {
	if (!r.room) {
		for (const d of r.lights.filter((l) => l.available && isLit(l, commands.pending) !== on))
			void commands.set(d.device_id, kindOf(d), { on }, d.attributes);
		return null;
	}
	const said = await roomPower(r.room.id, on);
	// Each light it sent a command to waits for its answer, as a bulb would.
	for (const id of said.lights) {
		const d = devices.byId[id];
		if (d) commands.expect(id, kindOf(d), { on }, d.attributes);
	}
	for (const d of r.lights)
		if (d.available && !said.lights.includes(d.device_id) && isLit(d, commands.pending) !== on)
			void commands.set(d.device_id, kindOf(d), { on }, d.attributes);
	return said.error ? `${r.name}: ${said.error}` : null;
}

/** Every light on in the house off: each room with one on, and those in no room. */
export async function everyLightOff(rows: Lights[]): Promise<string | null> {
	const going = rows.filter((r) => r.lights.some((d) => isLit(d, commands.pending)));
	const said = await Promise.all(going.map((r) => setLights(r, false)));
	return said.find((s) => s !== null) ?? null;
}
