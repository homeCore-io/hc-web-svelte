/**
 * Settings' two groups (08 §3): House — the things in it — and System — what
 * runs it. Every admin screen the round builds has its place here from the
 * start; the ones not built yet say when they arrive.
 */

export interface SettingsItem {
	slug: string;
	label: string;
	group: 'house' | 'system';
	/** Words a search should find it by, beyond its label. */
	words: string;
	/** Static description, where homeCore has nothing live to say. */
	detail: string;
	/** The milestone that builds it, while it isn't built. */
	coming?: { what: string; when: string };
}

export const SETTINGS: SettingsItem[] = [
	{
		slug: 'devices',
		label: 'Devices',
		group: 'house',
		words: 'devices names rooms',
		detail: 'Names, and which room each is in'
	},
	{
		slug: 'rooms',
		label: 'Rooms',
		group: 'house',
		words: 'rooms areas order icons',
		detail: 'Names, order and icons; new rooms'
	},
	{
		slug: 'scenes',
		label: 'Scenes',
		group: 'house',
		words: 'scenes movie bedtime',
		detail: 'homeCore’s own scenes'
	},
	{
		slug: 'modes',
		label: 'Modes',
		group: 'house',
		words: 'modes solar sunset sunrise offset night day away guests',
		detail: 'Day, night and your own'
	},
	{
		slug: 'helpers',
		label: 'Helpers',
		group: 'house',
		words: 'helpers timers switches counters flags groups thresholds schedules glue',
		detail: 'Timers, switches and counters'
	},
	{
		slug: 'automations',
		label: 'Automations',
		group: 'house',
		words: 'automations rules triggers conditions actions',
		detail: 'Rules, in words: what each does and when it last ran'
	},
	{
		slug: 'alerts',
		label: 'Alerts',
		group: 'house',
		words: 'alerts rules battery time door',
		detail: 'Time rules: a door open at night'
	},
	{
		slug: 'displays',
		label: 'Displays',
		group: 'house',
		words: 'displays kiosk tablet panel pin',
		detail: 'Kitchen panels and hall tablets'
	},
	{
		slug: 'asking',
		label: 'Asking first',
		group: 'house',
		words: 'confirm asking ask before',
		detail: 'Which commands ask before they go'
	},
	{
		slug: 'look',
		label: 'Look',
		group: 'house',
		words: 'theme look phone bar palette colour',
		detail: 'The house’s theme and phone bar'
	},

	{
		slug: 'plugins',
		label: 'Plugins',
		group: 'system',
		words: 'plugins integrations hue lutron sonos yolink zwave restart install registry',
		detail: 'What connects homeCore to devices'
	},
	{
		slug: 'people',
		label: 'People & access',
		group: 'system',
		words: 'users people roles passwords api keys pin access',
		detail: 'Accounts, roles and API keys'
	},
	{
		slug: 'configuration',
		label: 'Configuration',
		group: 'system',
		words:
			'configuration homecore.toml config port broker mqtt location influx logging auth whitelist',
		detail: 'homecore.toml'
	},
	{
		slug: 'notifications',
		label: 'Notifications',
		group: 'system',
		words: 'notifications notify pushover email telegram channels messages',
		detail: 'Where homeCore can send messages'
	},
	{
		slug: 'data',
		label: 'Data & backups',
		group: 'system',
		words: 'backup restore import export calendars data',
		detail: 'Backups, restore, calendars',
		coming: {
			what: 'Backing up and restoring the house, and its calendars.',
			when: 'A6, running the system'
		}
	},
	{
		slug: 'maintenance',
		label: 'Maintenance',
		group: 'system',
		words: 'maintenance orphaned restart cleanup',
		detail: 'Orphaned devices, restart',
		coming: {
			what: 'Tidying up after removed plugins, and restarting homeCore.',
			when: 'A6, running the system'
		}
	},
	{
		slug: 'logs',
		label: 'Logs',
		group: 'system',
		words: 'logs log level debug',
		detail: 'Live, from homeCore and its plugins',
		coming: {
			what: 'homeCore’s and its plugins’ logs, live, and their levels.',
			when: 'A6, running the system'
		}
	},
	{
		slug: 'events',
		label: 'Events',
		group: 'system',
		words: 'events stream mqtt',
		detail: 'Everything the house reports, live',
		coming: { what: 'Everything the house reports, as it happens.', when: 'A6, running the system' }
	},
	{
		slug: 'audit',
		label: 'Audit',
		group: 'system',
		words: 'audit sign in who changed',
		detail: 'Who changed what, and when',
		coming: { what: 'Who changed what, and when, in words.', when: 'A6, running the system' }
	},
	{
		slug: 'system',
		label: 'System',
		group: 'system',
		words: 'system version health status uptime storage',
		detail: 'Version, health, storage',
		coming: { what: 'homeCore’s version, health and storage.', when: 'A6, running the system' }
	}
];

export const settingsItem = (slug: string) => SETTINGS.find((s) => s.slug === slug);

/**
 * Whether every typed word starts a word in `text` — "port" finds a port,
 * not "export" or "reports".
 */
export function found(text: string, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (q === '') return true;
	const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
	return q.split(/\s+/).every((w) => words.some((x) => x.startsWith(w)));
}

/** Whether `item` matches what's typed, over its label, words and status. */
export const matches = (item: SettingsItem, query: string, status = '') =>
	found(`${item.label} ${item.words} ${status}`, query);

/** "75 days ago", "today", from an ISO time. */
export function daysAgo(iso: string, now = Date.now()): string {
	const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
	return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Bytes as a person reads them. */
export function size(bytes: number): string {
	const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
	let n = bytes;
	let u = 0;
	while (n >= 1000 && u < units.length - 1) {
		n /= 1000;
		u++;
	}
	return `${u === 0 ? n : n.toFixed(n < 10 ? 1 : 0)} ${units[u]}`;
}

/** Up time, roughly: "10 min", "3 h", "4 days". */
export function uptime(secs: number): string {
	if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))} min`;
	if (secs < 172_800) return `${Math.round(secs / 3600)} h`;
	return `${Math.round(secs / 86_400)} days`;
}

/** A backup this old, or none at all, is worth saying so on Settings. */
export const BACKUP_DUE_DAYS = 30;
export function backupDue(lastBackupAt: string | null, now = Date.now()): boolean {
	return lastBackupAt === null || now - Date.parse(lastBackupAt) > BACKUP_DUE_DAYS * 86_400_000;
}
