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

export async function createDashboardFromTemplate(id: string): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>(`/dashboards/templates/${id}`, {
		method: 'POST'
	});
	return parseDashboard(response);
}

export async function duplicateDashboard(id: string): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>(`/dashboards/${id}/duplicate`, {
		method: 'POST'
	});
	return parseDashboard(response);
}

export async function exportDashboard(id: string): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>(`/dashboards/${id}/export`);
	return parseDashboard(response);
}

export async function importDashboard(dashboard: DashboardDefinition): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>('/dashboards/import', {
		method: 'POST',
		body: JSON.stringify(dashboard)
	});
	return parseDashboard(response);
}

export async function setDefaultDashboard(id: string): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>(`/dashboards/${id}/default`, {
		method: 'POST'
	});
	return parseDashboard(response);
}
