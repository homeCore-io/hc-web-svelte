import type { DashboardDefinition } from '$lib/models/dashboard';
import * as dashboardsApi from '$lib/api/dashboards';

class DashboardsState {
	items = $state<DashboardDefinition[]>([]);
	templates = $state<DashboardDefinition[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.items = await dashboardsApi.listDashboards();
			this.templates = await dashboardsApi.listDashboardTemplates();
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Unable to load dashboards';
			throw error;
		} finally {
			this.loading = false;
		}
	}

	get defaultDashboard() {
		return this.items.find((item) => item.is_default) ?? this.items[0] ?? null;
	}
}

export const dashboardsState = new DashboardsState();
