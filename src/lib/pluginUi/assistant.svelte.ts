/**
 * The house's assistant (`app.assistant`): a running plugin's helper, opened
 * from the Ask button in the top bar of every page. On a wide screen it is a
 * panel at the right, beside the page; on a narrower one, over it; on a
 * phone, a page of its own (`/ask`). Whether the panel is open is this
 * browser's own (`hc.ask`), so it is open again after a reload.
 */
import { tick } from 'svelte';
import { goto } from '$app/navigation';
import { MediaQuery } from 'svelte/reactivity';
import { pluginUis, type PluginUi, type UiSlot } from './uis.svelte.js';

const KEY = 'hc.ask';
/** Wide enough for the panel beside the page, and still a page beside it. */
export const ASK_BESIDE = '(min-width: 1000px)';
/** Narrower than this is a phone's: the assistant is a page (`/ask`). */
export const ASK_PANEL = '(min-width: 700px)';

export interface AssistantOffer {
	pluginId: string;
	ui: PluginUi;
	slot: UiSlot;
}

/** The first running plugin (by id) that offers the slot. */
export function offerOf(byPlugin: Record<string, PluginUi>): AssistantOffer | undefined {
	for (const pluginId of Object.keys(byPlugin).sort()) {
		const ui = byPlugin[pluginId]!;
		const slot = ui.slots.find((s) => s.slot === 'app.assistant' && !!s.element);
		if (slot) return { pluginId, ui, slot };
	}
	return undefined;
}

function remembered(): boolean {
	try {
		return localStorage.getItem(KEY) === 'open';
	} catch {
		return false;
	}
}

class Assistant {
	/** The person's choice, as this browser remembers it. */
	#chosen = $state(remembered());
	#panel = new MediaQuery(ASK_PANEL, true);
	#beside = new MediaQuery(ASK_BESIDE, true);
	/** The button that opened it: the keyboard goes back there when it closes. */
	#opener: HTMLElement | null = null;
	/** Opened by the button just now: the panel puts the keyboard in it. */
	#focus = false;

	/** What the house offers, if anything. */
	get offer(): AssistantOffer | undefined {
		return offerOf(pluginUis.byPlugin);
	}
	/** The button's words: the slot's own, else "Ask". */
	get label(): string {
		return this.offer?.slot.label?.trim() || 'Ask';
	}
	/** Whether the panel is shown now. */
	get open(): boolean {
		return this.#chosen && this.#panel.current && this.offer !== undefined;
	}
	/** Beside the page (it makes room), or over it. */
	get beside(): boolean {
		return this.#beside.current;
	}

	#keep(open: boolean) {
		this.#chosen = open;
		try {
			if (open) localStorage.setItem(KEY, 'open');
			else localStorage.removeItem(KEY);
		} catch {
			// Open or closed for now; as it was next time.
		}
	}

	/** The Ask button: the panel open or closed, or on a phone, its page. */
	toggle(from: HTMLElement | null): void {
		if (!this.#panel.current) {
			void goto('/ask');
			return;
		}
		if (this.open) return this.close();
		this.#opener = from;
		this.#focus = true;
		this.#keep(true);
	}

	/** Whether the panel should take the keyboard now; once per opening. */
	takeFocus(): boolean {
		const f = this.#focus;
		this.#focus = false;
		return f;
	}

	/** Closed by the person: the keyboard goes back to the button that opened it. */
	close(): void {
		const inside = document.activeElement?.closest?.('#hc-ask') ?? null;
		this.#keep(false);
		if (!inside) return;
		const back = this.#opener?.isConnected
			? this.#opener
			: document.querySelector<HTMLElement>('[data-ask-button]');
		void tick().then(() => back?.focus());
	}
}

export const assistant = new Assistant();
