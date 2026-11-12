/**
 * Sending a media command (media.ts's `Cmd`) through `commands`: attributes
 * set and waited for; an action that stands for a reading, waited for too;
 * any other action, run.
 */
import { kindOf } from '../card.js';
import { commands } from '../commands.svelte.js';
import type { CoreDevice } from '../devices.js';
import type { Cmd } from './media.js';

export async function send(d: CoreDevice, cmd: Cmd | undefined): Promise<boolean> {
	if (!cmd) return false;
	if ('set' in cmd) {
		await commands.set(d.device_id, kindOf(d), cmd.set, d.attributes);
		return true;
	}
	if (cmd.want)
		return commands.actFor(d.device_id, kindOf(d), cmd.act, cmd.params, cmd.want, d.attributes);
	return commands.act(d.device_id, cmd.act, cmd.params);
}
