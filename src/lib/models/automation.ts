export type AutomationRule = {
	id: string;
	name: string;
	enabled: boolean;
	priority: number;
	tags: string[];
	error?: string | null;
	trigger: Record<string, unknown>;
	conditions: Record<string, unknown>[];
	actions: Record<string, unknown>[];
};

export function parseAutomationRule(input: unknown): AutomationRule {
	const value = input as Record<string, unknown>;
	return {
		id: String(value.id),
		name: String(value.name ?? value.id),
		enabled: Boolean(value.enabled ?? true),
		priority: Number(value.priority ?? 0),
		tags: Array.isArray(value.tags)
			? (value.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
			: [],
		error: typeof value.error === 'string' ? value.error : null,
		trigger: ((value.trigger as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>,
		conditions: Array.isArray(value.conditions)
			? (value.conditions as Record<string, unknown>[])
			: [],
		actions: Array.isArray(value.actions) ? (value.actions as Record<string, unknown>[]) : []
	};
}

export function automationTriggerSummary(rule: AutomationRule): string {
	const type = String(rule.trigger.type ?? 'Unknown');
	if (type === 'DeviceStateChanged') {
		const target =
			rule.trigger.device ??
			rule.trigger.device_id ??
			(Array.isArray(rule.trigger.devices) && rule.trigger.devices.length > 0 ? String(rule.trigger.devices[0]) : null) ??
			(Array.isArray(rule.trigger.device_ids) && rule.trigger.device_ids.length > 0 ? String(rule.trigger.device_ids[0]) : null);
		const attribute = rule.trigger.attribute ? ` · ${String(rule.trigger.attribute)}` : '';
		return `${type}${target ? ` · ${String(target)}` : ''}${attribute}`;
	}
	if (type === 'TimeOfDay') {
		return `${type} · ${String(rule.trigger.time ?? 'Unknown time')}`;
	}
	if (type === 'SunEvent') {
		return `${type} · ${String(rule.trigger.event ?? 'Unknown')}`;
	}
	if (type === 'WebhookReceived') {
		return `${type} · ${String(rule.trigger.path ?? 'Unknown path')}`;
	}
	if (type === 'MqttMessage') {
		return `${type} · ${String(rule.trigger.topic_pattern ?? 'Unknown topic')}`;
	}
	return type;
}

export function automationConditionsSummary(rule: AutomationRule): string {
	const count = rule.conditions.length;
	return count === 0 ? 'No conditions' : count === 1 ? '1 condition' : `${count} conditions`;
}

export function automationActionsSummary(rule: AutomationRule): string {
	const count = rule.actions.length;
	if (count === 0) return 'No actions';
	const firstType = rule.actions[0]?.type ? String(rule.actions[0].type) : 'Action';
	return count === 1 ? firstType : `${firstType} +${count - 1}`;
}

export function automationTagsSummary(rule: AutomationRule): string {
	if (rule.tags.length === 0) return 'No tags';
	return rule.tags.join(', ');
}
