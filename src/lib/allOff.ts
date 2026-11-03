/**
 * A room's "All off" (C5): each thing that's on, turned off the way it's
 * turned off — a switch, `on`, or pause for what plays. The same for the
 * rooms list, the room boxes and anywhere else a room offers it.
 */
import type { CardView } from './card.js';
import { commands } from './commands.svelte.js';
import type { CoreDevice } from './devices.js';

export function allOff(targets: CardView[], devices: CoreDevice[]): void {
	for (const c of targets) {
		const d = devices.find((x) => x.device_id === c.id);
		if (d === undefined || c.control === null) continue;
		if (c.control.kind === 'switch')
			void commands.set(c.id, c.kind, { [c.control.attr]: false }, d.attributes);
		else if (d.schema?.attributes.on?.writable)
			void commands.set(c.id, c.kind, { on: false }, d.attributes);
		else if (d.schema?.actions?.some((a) => a.id === 'pause')) void commands.act(c.id, 'pause');
	}
}
