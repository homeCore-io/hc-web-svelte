/**
 * Which plugins carry their own screens (`GET /plugins/ui`), and where they
 * go. Read once while the app is open, and again when a plugin starts,
 * stops or says something new about itself.
 */
import { live } from '../live.svelte.js';

/** The `host` interface this app offers. */
export const HOST_API = 1;

export interface UiSlot {
	slot: 'plugin.page' | 'device.panel' | string;
	element: string;
	device_types?: string[];
}
export interface PluginUi {
	host_api: number;
	version: string;
	/** A hash of its files: each build has its own address. */
	build: string;
	entry: string;
	slots: UiSlot[];
}

/** What a plugin's `rule.step` element class offers the editor. */
export interface StepClass {
	accepts?(value: Record<string, unknown>): boolean;
	describe?(host: unknown, deviceIds: string[], value: Record<string, unknown>): string | undefined;
}

class PluginUis {
	byPlugin = $state<Record<string, PluginUi>>({});
	loaded = $state(false);
	/** Each plugin's `rule.step` class, once its module has loaded. */
	steps = $state<Record<string, StepClass>>({});
	#started = false;

	ensure(): void {
		if (this.#started) return;
		this.#started = true;
		void this.load();
		live.listen((f) => {
			const t = (f as { type?: string }).type;
			if (
				t === 'plugin_capabilities' ||
				t === 'plugin_registered' ||
				t === 'plugin_offline' ||
				t === 'plugin_status_changed'
			)
				void this.load();
		});
	}

	async load(): Promise<void> {
		try {
			const r = await fetch('/api/v1/plugins/ui');
			const list = r.ok ? ((await r.json()) as { plugin_id: string; ui: PluginUi }[]) : [];
			// Only what this app can host.
			this.byPlugin = Object.fromEntries(
				list.filter((x) => x.ui.host_api === HOST_API).map((x) => [x.plugin_id, x.ui])
			);
			// A step's words are needed wherever an automation is shown, so a
			// plugin with its own step form is loaded now, not when one opens.
			for (const [id, ui] of Object.entries(this.byPlugin)) {
				const slot = ui.slots.find((x) => x.slot === 'rule.step');
				if (slot)
					void loadModule(id, ui, slot.element)
						.then(() => {
							const cls = customElements.get(slot.element) as unknown as StepClass | undefined;
							if (cls) this.steps = { ...this.steps, [id]: cls };
						})
						.catch(() => {});
			}
		} catch {
			this.byPlugin = {};
		}
		this.loaded = true;
	}

	/** The element for a slot of a plugin, if it declared one. */
	find(
		pluginId: string | undefined,
		slot: string,
		deviceType?: string | null
	): { ui: PluginUi; slot: UiSlot } | undefined {
		const ui = pluginId ? this.byPlugin[pluginId] : undefined;
		const s = ui?.slots.find(
			(x) =>
				x.slot === slot &&
				(slot === 'plugin.page' ||
					!x.device_types?.length ||
					x.device_types.includes(deviceType ?? ''))
		);
		return ui && s ? { ui, slot: s } : undefined;
	}
}

export const pluginUis = new PluginUis();

/**
 * Where its module is: asked of the running plugin, which carries it, through
 * homeCore (`GET /plugins/{id}/ui/{build}/{file}`). A build never changes, so
 * the browser keeps it.
 */
export const moduleUrl = (pluginId: string, ui: PluginUi) =>
	`/api/v1/plugins/${encodeURIComponent(pluginId)}/ui/${encodeURIComponent(ui.build)}/${ui.entry
		.split('/')
		.map(encodeURIComponent)
		.join('/')}`;

const loading = new Map<string, Promise<void>>();
/** Import a plugin's module once; resolved when its element is defined. */
export function loadModule(pluginId: string, ui: PluginUi, element: string): Promise<void> {
	const url = moduleUrl(pluginId, ui);
	let p = loading.get(url);
	if (!p) {
		p = import(/* @vite-ignore */ url).then(() => undefined);
		p.catch(() => loading.delete(url));
		loading.set(url, p);
	}
	return p.then(() => customElements.whenDefined(element)).then(() => undefined);
}

/** Every device a step sets — a SetDeviceState, or a Parallel of them — or null. */
export function stepTargets(action: unknown): string[] | null {
	if (!action || typeof action !== 'object') return null;
	const a = action as Record<string, unknown>;
	const one = a.SetDeviceState as Record<string, unknown> | undefined;
	if (one && typeof one.device_id === 'string') return [one.device_id];
	const many = (a.Parallel as { actions?: unknown[] } | undefined)?.actions;
	if (!Array.isArray(many) || !many.length) return null;
	const ids = many.map((x) => stepTargets(x));
	return ids.every((x) => x?.length === 1) ? ids.map((x) => x![0]!) : null;
}
