import type { DashboardDefinition } from '$lib/models/dashboard';
import { parseDashboard } from '$lib/models/dashboard';
import { apiRequest } from './client';

type DashboardReloadResponse = {
	status: string;
	dashboards_total: number;
	user_defaults_total: number;
};

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

export async function updateDashboard(
	id: string,
	dashboard: DashboardDefinition
): Promise<DashboardDefinition> {
	const response = await apiRequest<unknown>(`/dashboards/${id}`, {
		method: 'PUT',
		body: JSON.stringify(dashboard)
	});
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

export async function deleteDashboard(id: string): Promise<void> {
	await apiRequest<unknown>(`/dashboards/${id}`, {
		method: 'DELETE'
	});
}

export async function reloadDashboards(): Promise<DashboardReloadResponse> {
	return apiRequest<DashboardReloadResponse>('/dashboards/reload', {
		method: 'POST'
	});
}
