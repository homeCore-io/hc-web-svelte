import type { DashboardDefinition } from '$lib/models/dashboard';
import * as dashboardsApi from '$lib/api/dashboards';

class DashboardsState {
	items = $state<DashboardDefinition[]>([]);
	templates = $state<DashboardDefinition[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	loaded = $state(false);

	async load() {
		this.loading = true;
		this.error = null;
		try {
			this.items = await dashboardsApi.listDashboards();
			this.templates = await dashboardsApi.listDashboardTemplates();
			this.loaded = true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Unable to load dashboards';
			throw error;
		} finally {
			this.loading = false;
		}
	}

	async ensureLoaded() {
		if (!this.loaded && !this.loading) {
			await this.load();
		}
	}

	getById(id: string) {
		return this.items.find((item) => item.id === id) ?? null;
	}

	mergeDashboard(dashboard: DashboardDefinition) {
		const nextItems = this.items.slice();
		const index = nextItems.findIndex((item) => item.id === dashboard.id);
		if (index >= 0) {
			nextItems[index] = dashboard;
		} else {
			nextItems.push(dashboard);
		}
		this.items = nextItems;
	}

	get defaultDashboard() {
		return this.items.find((item) => item.is_default) ?? this.items[0] ?? null;
	}

	async createFromTemplate(id: string) {
		const created = await dashboardsApi.createDashboardFromTemplate(id);
		await this.load();
		return created;
	}

	async duplicate(id: string) {
		const created = await dashboardsApi.duplicateDashboard(id);
		await this.load();
		return created;
	}

	async export(id: string) {
		return dashboardsApi.exportDashboard(id);
	}

	async import(dashboard: DashboardDefinition) {
		const created = await dashboardsApi.importDashboard(dashboard);
		await this.load();
		return created;
	}

	async setDefault(id: string) {
		const updated = await dashboardsApi.setDefaultDashboard(id);
		await this.load();
		return updated;
	}

	async delete(id: string) {
		await dashboardsApi.deleteDashboard(id);
		await this.load();
	}

	async reloadStore() {
		const result = await dashboardsApi.reloadDashboards();
		await this.load();
		return result;
	}
}

export const dashboardsState = new DashboardsState();
