/**
 * Which plugins carry their own screens (`GET /plugins/ui`), and where they
 * go. Read once while the app is open, and again when a plugin starts,
 * stops or says something new about itself.
 */
import { live } from '../live.svelte.js';

/** The `host` interface this app offers. */
export const HOST_API = 1;

export interface UiSlot {
	slot: 'plugin.page' | 'device.panel' | 'rule.step' | 'device.card' | 'dashboard.card' | string;
	element: string;
	device_types?: string[];
	/** A dashboard card's name in "Add a card". */
	label?: string;
	description?: string;
	/** A card's sizes; every size when absent. */
	forms?: ('compact' | 'standard' | 'large')[];
	/** A dashboard card's settings element. */
	settings?: string;
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

	/** Every plugin's dashboard cards, for "Add a card". */
	cards(): { pluginId: string; ui: PluginUi; slot: UiSlot }[] {
		return Object.entries(this.byPlugin).flatMap(([pluginId, ui]) =>
			ui.slots.filter((s) => s.slot === 'dashboard.card').map((slot) => ({ pluginId, ui, slot }))
		);
	}

	/** A dashboard card by its plugin and element. */
	card(pluginId: string, element: string): { ui: PluginUi; slot: UiSlot } | undefined {
		const ui = this.byPlugin[pluginId];
		const slot = ui?.slots.find((s) => s.slot === 'dashboard.card' && s.element === element);
		return ui && slot ? { ui, slot } : undefined;
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
/**
 * Which build defined each element. A page can define an element only once:
 * when a plugin is updated while the app is open, its new build can't replace
 * the elements the old one defined until the app is reloaded.
 */
const definedBy = new Map<string, string>();

/** Whether `element` is still the one an older build of this plugin defined. */
export const isStale = (element: string, ui: PluginUi): boolean => {
	const was = definedBy.get(element);
	return was !== undefined && was !== ui.build;
};

/** Import a plugin's module once; resolved when its element is defined. */
export function loadModule(pluginId: string, ui: PluginUi, element: string): Promise<void> {
	// Updated while open: keep the element the old build defined (importing the
	// new one would throw, and the screen would fall back to the generic page).
	if (isStale(element, ui) && customElements.get(element)) return Promise.resolve();
	const url = moduleUrl(pluginId, ui);
	let p = loading.get(url);
	if (!p) {
		p = import(/* @vite-ignore */ url).then(() => {
			for (const s of ui.slots) if (!definedBy.has(s.element)) definedBy.set(s.element, ui.build);
		});
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
