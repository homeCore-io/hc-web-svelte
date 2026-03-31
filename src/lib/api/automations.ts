import {
	parseAutomationRule,
	type AutomationRule
} from '$lib/models/automation';
import { apiRequest } from './client';

export async function listAutomations(): Promise<AutomationRule[]> {
	const response = await apiRequest<unknown[]>('/automations');
	return response.map(parseAutomationRule);
}
