export type DashboardVisibility = 'private' | 'shared' | 'public';
export type DashboardBreakpoint = 'mobile' | 'tablet' | 'desktop' | 'tv';
export type DashboardRefreshPolicy = 'live' | 'poll' | 'manual' | 'passive';
export type DashboardWidgetType =
	| 'device_grid'
	| 'device_list'
	| 'device_tile'
	| 'stat_summary'
	| 'mode_chips'
	| 'scene_row'
	| 'event_feed'
	| 'history_chart'
	| 'media_player'
	| 'camera_video'
	| 'web_embed'
	| 'markdown'
	| 'dashboard_link';

export type DashboardWidgetPlacement = {
	widget_id: string;
	x: number;
	y: number;
	w: number;
	h: number;
};

export type DashboardLayout = {
	breakpoint: DashboardBreakpoint;
	columns: number;
	row_height: number;
	gap: number;
	placements: DashboardWidgetPlacement[];
};

export type DashboardWidget = {
	id: string;
	type: DashboardWidgetType;
	title: string;
	subtitle?: string | null;
	refresh_policy: DashboardRefreshPolicy;
	config: Record<string, unknown>;
};

export type DashboardDefinition = {
	id: string;
	name: string;
	description?: string | null;
	owner_user_id: string;
	visibility: DashboardVisibility;
	tags: string[];
	icon: string;
	is_default?: boolean;
	created_at: string;
	updated_at: string;
	layouts: DashboardLayout[];
	widgets: DashboardWidget[];
};

export function dashboardBreakpointForWidth(width: number): DashboardBreakpoint {
	if (width < 600) return 'mobile';
	if (width < 1200) return 'tablet';
	if (width < 1800) return 'desktop';
	return 'tv';
}

export function layoutForBreakpoint(
	dashboard: DashboardDefinition,
	breakpoint: DashboardBreakpoint
): DashboardLayout | undefined {
	return (
		dashboard.layouts.find((layout) => layout.breakpoint === breakpoint) ?? dashboard.layouts[0]
	);
}

export function parseDashboard(input: unknown): DashboardDefinition {
	const value = input as Record<string, unknown>;
	if (value.dashboard && typeof value.dashboard === 'object') {
		const nested = value.dashboard as Record<string, unknown>;
		return {
			...(nested as DashboardDefinition),
			is_default: (value.is_default as boolean | undefined) ?? false
		};
	}
	return value as DashboardDefinition;
}
