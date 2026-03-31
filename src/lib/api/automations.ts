import {
	parseAutomationRule,
	type AutomationRule
} from '$lib/models/automation';
import { apiRequest } from './client';

function parseAutomationList(input: unknown): AutomationRule[] {
	if (Array.isArray(input)) {
		return input.map(parseAutomationRule);
	}
	if (typeof input === 'object' && input !== null) {
		const value = input as Record<string, unknown>;
		if (Array.isArray(value.rules)) {
			return value.rules.map(parseAutomationRule);
		}
		if (Array.isArray(value.automations)) {
			return value.automations.map(parseAutomationRule);
		}
	}
	return [];
}

export async function listAutomations(): Promise<AutomationRule[]> {
	const primary = parseAutomationList(await apiRequest<unknown>('/automations'));
	if (primary.length > 0) return primary;
	const fallback = parseAutomationList(await apiRequest<unknown>('/automations/export'));
	return fallback;
}
