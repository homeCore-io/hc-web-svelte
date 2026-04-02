import type { DashboardCardTone, DashboardWidget, DashboardWidgetType } from '$lib/models/dashboard';
import type { MaterialIconName } from '$lib/components/ui/MaterialIcon.svelte';
import { titleCase } from '$lib/utils/formatting';

export type DashboardCardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type DashboardCardSpec = {
	family: string;
	icon: MaterialIconName;
	size: DashboardCardSize;
	tone: DashboardCardTone;
	minWidth: number;
	minHeight: number;
	preferredWidth: number;
	growY: boolean;
};

export type DashboardCardTemplate = {
	type: DashboardWidgetType;
	title: string;
	subtitle: string | null;
	refresh_policy: DashboardWidget['refresh_policy'];
	config: Record<string, unknown>;
};

const CARD_SPECS: Record<DashboardWidgetType, DashboardCardSpec> = {
	device_grid: {
		family: 'Entity Overview',
		icon: 'device_grid',
		size: 'lg',
		tone: 'neutral',
		minWidth: 2,
		minHeight: 2,
		preferredWidth: 4,
		growY: true
	},
	device_list: {
		family: 'Entity Overview',
		icon: 'device_list',
		size: 'md',
		tone: 'neutral',
		minWidth: 2,
		minHeight: 2,
		preferredWidth: 3,
		growY: true
	},
	device_tile: {
		family: 'Entity Overview',
		icon: 'device_tile',
		size: 'sm',
		tone: 'neutral',
		minWidth: 1,
		minHeight: 1,
		preferredWidth: 2,
		growY: false
	},
	stat_summary: {
		family: 'Summary',
		icon: 'summary',
		size: 'md',
		tone: 'good',
		minWidth: 2,
		minHeight: 1,
		preferredWidth: 3,
		growY: false
	},
	mode_chips: {
		family: 'Modes',
		icon: 'modes',
		size: 'sm',
		tone: 'good',
		minWidth: 2,
		minHeight: 1,
		preferredWidth: 2,
		growY: false
	},
	scene_row: {
		family: 'Scenes',
		icon: 'scenes',
		size: 'sm',
		tone: 'good',
		minWidth: 2,
		minHeight: 1,
		preferredWidth: 2,
		growY: false
	},
	event_feed: {
		family: 'Activity',
		icon: 'events',
		size: 'lg',
		tone: 'warn',
		minWidth: 2,
		minHeight: 2,
		preferredWidth: 4,
		growY: true
	},
	history_chart: {
		family: 'History',
		icon: 'history',
		size: 'xl',
		tone: 'media',
		minWidth: 3,
		minHeight: 2,
		preferredWidth: 5,
		growY: true
	},
	media_player: {
		family: 'Media',
		icon: 'media',
		size: 'lg',
		tone: 'media',
		minWidth: 2,
		minHeight: 2,
		preferredWidth: 4,
		growY: true
	},
	camera_video: {
		family: 'Camera',
		icon: 'camera',
		size: 'xl',
		tone: 'media',
		minWidth: 3,
		minHeight: 2,
		preferredWidth: 5,
		growY: true
	},
	web_embed: {
		family: 'Embed',
		icon: 'embed',
		size: 'lg',
		tone: 'neutral',
		minWidth: 3,
		minHeight: 2,
		preferredWidth: 5,
		growY: true
	},
	markdown: {
		family: 'Notes',
		icon: 'note',
		size: 'md',
		tone: 'neutral',
		minWidth: 2,
		minHeight: 2,
		preferredWidth: 3,
		growY: true
	},
	dashboard_link: {
		family: 'Navigation',
		icon: 'link',
		size: 'xs',
		tone: 'neutral',
		minWidth: 1,
		minHeight: 1,
		preferredWidth: 2,
		growY: false
	}
};

export function dashboardCardSpec(type: DashboardWidgetType): DashboardCardSpec {
	return CARD_SPECS[type];
}

export function dashboardWidgetLabel(type: DashboardWidgetType): string {
	return titleCase(type);
}

const CARD_TEMPLATES: Record<DashboardWidgetType, DashboardCardTemplate> = {
	device_grid: {
		type: 'device_grid',
		title: 'Device Grid',
		subtitle: 'Query-based device overview',
		refresh_policy: 'live',
		config: {
			selection_mode: 'query',
			query: '',
			limit: 8,
			show_offline: true
		}
	},
	device_list: {
		type: 'device_list',
		title: 'Device List',
		subtitle: 'Compact device inventory',
		refresh_policy: 'live',
		config: {
			selection_mode: 'query',
			query: '',
			limit: 10,
			show_offline: true
		}
	},
	device_tile: {
		type: 'device_tile',
		title: 'Device Tile',
		subtitle: 'Single device status tile',
		refresh_policy: 'live',
		config: {
			selection_mode: 'manual',
			device_ids: [],
			show_offline: true
		}
	},
	stat_summary: {
		type: 'stat_summary',
		title: 'Stat Summary',
		subtitle: 'Key dashboard counts',
		refresh_policy: 'live',
		config: {
			metrics: ['devices', 'on', 'offline']
		}
	},
	mode_chips: {
		type: 'mode_chips',
		title: 'Mode Chips',
		subtitle: 'Current mode states',
		refresh_policy: 'live',
		config: {}
	},
	scene_row: {
		type: 'scene_row',
		title: 'Scenes',
		subtitle: 'Quick scene access',
		refresh_policy: 'manual',
		config: {}
	},
	event_feed: {
		type: 'event_feed',
		title: 'Event Feed',
		subtitle: 'Recent HomeCore activity',
		refresh_policy: 'live',
		config: {
			limit: 8,
			group_by: 'none'
		}
	},
	history_chart: {
		type: 'history_chart',
		title: 'History Chart',
		subtitle: 'Time-series history',
		refresh_policy: 'poll',
		config: {
			limit: 24,
			timeframe_hours: 24
		}
	},
	media_player: {
		type: 'media_player',
		title: 'Media Player',
		subtitle: 'Transport and artwork',
		refresh_policy: 'live',
		config: {
			selection_mode: 'manual',
			device_ids: []
		}
	},
	camera_video: {
		type: 'camera_video',
		title: 'Camera',
		subtitle: 'Live camera preview',
		refresh_policy: 'poll',
		config: {
			source_type: 'url',
			url: '',
			refresh_secs: 15
		}
	},
	web_embed: {
		type: 'web_embed',
		title: 'Web Embed',
		subtitle: 'Embedded external content',
		refresh_policy: 'manual',
		config: {
			url: ''
		}
	},
	markdown: {
		type: 'markdown',
		title: 'Markdown',
		subtitle: 'Notes or status copy',
		refresh_policy: 'manual',
		config: {
			markdown: '## New Card\nAdd dashboard notes here.'
		}
	},
	dashboard_link: {
		type: 'dashboard_link',
		title: 'Dashboard Links',
		subtitle: 'Jump between views',
		refresh_policy: 'manual',
		config: {
			dashboard_ids: []
		}
	}
};

export function dashboardCardTemplate(type: DashboardWidgetType): DashboardCardTemplate {
	return structuredClone(CARD_TEMPLATES[type]);
}

export function dashboardCardTemplates(): DashboardCardTemplate[] {
	return (Object.keys(CARD_TEMPLATES) as DashboardWidgetType[]).map((type) => dashboardCardTemplate(type));
}
