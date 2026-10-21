/**
 * The house's names, as the alert-to-automation screens use them: devices by
 * their names, plugins by theirs, alert rules and plugins' kinds of alert.
 */
import type { AlertRule } from './alerts.js';
import type { Names } from './alertStarts.js';
import { devices } from './devices.svelte.js';
import { displayName } from './devices.js';
import { alertKinds, pluginName } from './alertKinds.svelte.js';

export function houseNames(rules: AlertRule[]): Names {
	return {
		device: (id) => devices.byId[id],
		deviceName: (id) => {
			const d = devices.byId[id];
			return d ? displayName(d) : id;
		},
		pluginName,
		devices: Object.values(devices.byId),
		rules,
		topicLabel: (p, t) => alertKinds.label(p, t)
	};
}
