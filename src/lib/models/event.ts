export type HcEvent = {
	type: string;
	timestamp: string;
	device_id?: string;
	[key: string]: unknown;
};

export type LogEntry = {
	seq: number;
	event_type: string;
	device_id?: string;
	event: HcEvent & {
		scene_id?: string;
		scene_name?: string;
	};
};

export function eventTargetLabel(entry: LogEntry): string {
	if (entry.event.scene_name) return String(entry.event.scene_name);
	if (entry.event.scene_id) return String(entry.event.scene_id);
	if (entry.event.rule_name) return String(entry.event.rule_name);
	if (entry.event.rule_id) return String(entry.event.rule_id);
	if (entry.device_id) return String(entry.device_id);
	if (entry.event.device_id) return String(entry.event.device_id);
	if (entry.event.plugin_id) return String(entry.event.plugin_id);
	return 'System';
}

export function eventSummary(entry: LogEntry): string {
	if (entry.event_type === 'scene_activated') {
		return `Activated ${entry.event.scene_name ?? entry.event.scene_id ?? 'scene'}`;
	}
	if (entry.event_type === 'rule_fired') {
		return `Rule fired: ${entry.event.rule_name ?? entry.event.rule_id ?? 'unknown'}`;
	}
	if (entry.event_type === 'device_state_changed') {
		return `State updated for ${entry.device_id ?? entry.event.device_id ?? 'device'}`;
	}
	if (entry.event_type === 'device_availability_changed') {
		const available =
			typeof entry.event.available === 'boolean' ? (entry.event.available ? 'online' : 'offline') : 'changed';
		return `Availability ${available} for ${entry.device_id ?? entry.event.device_id ?? 'device'}`;
	}
	if (entry.event_type === 'plugin_registered') {
		return `Plugin registered: ${entry.event.plugin_id ?? 'unknown'}`;
	}
	if (entry.event_type === 'plugin_offline') {
		return `Plugin offline: ${entry.event.plugin_id ?? 'unknown'}`;
	}
	if (entry.event_type === 'system_alert') {
		return `${entry.event.severity ?? 'alert'}: ${entry.event.message ?? 'System alert'}`;
	}
	return JSON.stringify(entry.event);
}
