/**
 * A plugin step in words, from the plugin's own `rule.step` class (its
 * `describe`), for the automation sentences — `undefined` when the plugin
 * has none, or its module hasn't loaded yet (the generic words stand in).
 */
import type { CoreDevice } from '../devices.js';
import { createHost } from './host.svelte.js';
import { pluginUis } from './uis.svelte.js';

export function describeStep(
	device: (id: string) => CoreDevice | undefined,
	ids: string[],
	state: unknown
): string | undefined {
	if (!state || typeof state !== 'object' || Array.isArray(state)) return undefined;
	// Wherever automations are shown: their plugins' step words load once.
	pluginUis.ensure();
	const pluginId = device(ids[0] ?? '')?.plugin_id;
	const cls = pluginId ? pluginUis.steps[pluginId] : undefined;
	if (!pluginId || !cls?.describe) return undefined;
	try {
		return cls.describe(createHost(pluginId), ids, state as Record<string, unknown>);
	} catch {
		return undefined;
	}
}
