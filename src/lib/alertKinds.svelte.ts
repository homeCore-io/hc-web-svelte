/**
 * The kinds of alert plugins can raise (`GET /alerts/kinds`), with what the
 * house decided about each — on or off, sent where. Read once while the app
 * is open; the settings that change them reload it.
 */
import { knownPluginName } from './inventory.js';

export interface AlertKindSetting {
	plugin_id: string;
	topic: string;
	label: string;
	description?: string | null;
	severity: 'info' | 'warning' | 'error';
	default_on: boolean;
	enabled: boolean;
	notify?: string | null;
}

/** homeCore's own kinds, for a filter that names one. */
export const BUILT_IN_KINDS: { value: string; label: string }[] = [
	{ value: 'wet', label: 'Water' },
	{ value: 'smoke', label: 'Smoke' },
	{ value: 'offline', label: 'Offline' },
	{ value: 'jammed', label: 'Jammed lock' },
	{ value: 'low_battery', label: 'Low battery' },
	{ value: 'rule', label: 'A time rule' }
];

/** A plugin's name for a person, from its id. */
export const pluginName = (id: string): string => {
	const bare = id.replace(/^plugin\./, '').replace(/^hc-/, '');
	return knownPluginName(bare) ?? bare.charAt(0).toUpperCase() + bare.slice(1);
};

class AlertKinds {
	list = $state<AlertKindSetting[]>([]);
	loaded = $state(false);
	#loading = false;

	ensure(): void {
		if (this.loaded || this.#loading) return;
		void this.load();
	}

	async load(): Promise<void> {
		this.#loading = true;
		try {
			const r = await fetch('/api/v1/alerts/kinds');
			this.list = r.ok ? ((await r.json()) as AlertKindSetting[]) : [];
		} catch {
			this.list = [];
		}
		this.loaded = true;
		this.#loading = false;
	}

	label(pluginId: string, topic: string): string | undefined {
		return this.list.find((k) => k.plugin_id === pluginId && k.topic === topic)?.label;
	}

	/** Save one kind's setting; null fields go back to the plugin's default. */
	async put(
		pluginId: string,
		topic: string,
		body: { enabled?: boolean | null; notify?: string | null }
	): Promise<string | null> {
		try {
			const r = await fetch(
				`/api/v1/alerts/kinds/${encodeURIComponent(pluginId)}/${encodeURIComponent(topic)}`,
				{
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				}
			);
			if (!r.ok)
				return r.status === 403 ? "You aren't allowed to do this." : `homeCore said ${r.status}.`;
			await this.load();
			return null;
		} catch {
			return 'homeCore is not answering.';
		}
	}
}

export const alertKinds = new AlertKinds();
