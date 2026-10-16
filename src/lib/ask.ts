/**
 * Asking before a command (D2): where the household or the device says to.
 * See `asks` for whose word counts.
 */
import { asks } from './layers.js';
import { household } from './household.svelte.js';
import { ask } from './confirm.svelte.js';

/**
 * Whether to go ahead: true at once if nobody asked for a question, else the
 * person's answer. `declared` is the device's own prompt, if it has one.
 */
export async function goAhead(
	device: string,
	kind: string,
	question: string,
	declared?: string
): Promise<boolean> {
	if (!asks(household.doc, device, kind, declared !== undefined)) return true;
	return ask({ title: declared ?? question, go: 'Go ahead', stay: 'Not now' });
}
