import type { DashboardDefinition } from '$lib/models/dashboard';
import { parseDashboard } from '$lib/models/dashboard';
import { apiRequest } from './client';

export async function listDashboards(): Promise<DashboardDefinition[]> {
	const response = await apiRequest<unknown[]>('/dashboards');
	return response.map(parseDashboard);
}

export async function listDashboardTemplates(): Promise<DashboardDefinition[]> {
	const response = await apiRequest<unknown[]>('/dashboards/templates');
	return response.map(parseDashboard);
}

export async function getDashboard(id: string): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>(`/dashboards/${id}`);
	return parseDashboard(response);
}
