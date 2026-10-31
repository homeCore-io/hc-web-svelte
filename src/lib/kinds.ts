/**
 * The kinds of card a page can hold (G2, 11 §2.2): for each, the sizes it can
 * be, what it's called, whether it can be starred, its settings (a form-engine
 * descriptor; plugins' cards have their own element instead), and what draws it.
 *
 * A new kind of card is one entry here; every page then has it.
 */
import type { Component } from 'svelte';
import type { Descriptor } from './descriptor.js';
import { displayName } from './devices.js';
import type { Form } from './layers.js';
import type { Card, Layout } from './page.js';
import { ROOM_BUILT_IN, SUMMARY_BUILT_IN, roomDescriptor, summaryDescriptor } from './options.js';
import { fieldSize } from './roomBox.js';
import AlertsKind from './components/kinds/AlertsKind.svelte';
import ChipsKind from './components/kinds/ChipsKind.svelte';
import DeviceKind from './components/kinds/DeviceKind.svelte';
import ModesKind from './components/kinds/ModesKind.svelte';
import PluginKind from './components/kinds/PluginKind.svelte';
import RoomKind from './components/kinds/RoomKind.svelte';
import SceneKind from './components/kinds/SceneKind.svelte';
import SummaryKind from './components/kinds/SummaryKind.svelte';

type CardOf<K extends Card['kind']> = Extract<Card, { kind: K }>;

/** What a kind's component is handed. */
export interface KindProps<K extends Card['kind'] = Card['kind']> {
	card: CardOf<K>;
	/** Its size, where it has sizes. */
	form?: Form;
	/** The name it was given on this page. */
	label?: string;
	/** The page's key, `home` or `room:<id>`. */
	page: string;
	/** The page lets device cards carry their own tools (room pages). */
	cardTools: boolean;
	/** Its settings on this page: a plugin card's as its element made them. */
	config?: Record<string, unknown>;
	/** How its section lays cards out. */
	layout?: Layout;
	/** Settings to draw with instead of the page's — a settings sheet's preview. */
	options?: Record<string, unknown>;
}

export interface Kind<K extends Card['kind'] = Card['kind']> {
	/** The sizes it can be; none for a card that has one shape. */
	forms(card: CardOf<K>): Form[];
	/** Its size: the one it was given, if it can be that, else its own default. */
	form(card: CardOf<K>, given: Form | undefined): Form | undefined;
	/** What it is called, before any name given on the page. */
	name(card: CardOf<K>): string;
	/** Whether it can be one of a person's favourites. */
	star: boolean;
	/** Its settings, for the settings sheet (G2); `null` while it has none. */
	options: ((card: CardOf<K>) => Descriptor) | null;
	/** The settings it has before anyone sets any. */
	defaults: Record<string, unknown>;
	/** Its size in a `field` section, 1–3; 1 where it doesn't say. */
	span?: (card: CardOf<K>) => 1 | 2 | 3;
	/** Whether Add offers it. G-a adds nothing new: Add keeps its own list. */
	addable: false | { pages: ('home' | 'room')[] };
	component: Component<KindProps<K>>;
}

const ALL: Form[] = ['compact', 'standard', 'large'];
const one = { forms: () => [], form: () => undefined };
const fixed = { star: false, options: null, defaults: {}, addable: false as const };

export const kinds: { [K in Card['kind']]: Kind<K> } = {
	device: {
		forms: (c) => (c.scene ? [] : ALL),
		form: (c, given) => (c.scene ? undefined : (given ?? c.form ?? 'standard')),
		name: (c) => displayName(c.device),
		star: true,
		options: null,
		defaults: {},
		addable: { pages: ['home', 'room'] },
		component: DeviceKind
	},
	scene: {
		...one,
		name: (c) => c.name,
		star: true,
		options: null,
		defaults: {},
		addable: { pages: ['home', 'room'] },
		component: SceneKind
	},
	room: {
		...one,
		...fixed,
		name: (c) => c.name,
		options: (c) => roomDescriptor(c.id === 'none' ? undefined : c.id),
		defaults: ROOM_BUILT_IN,
		span: (c) => fieldSize(c.devices.length),
		component: RoomKind
	},
	plugin: {
		// Only the sizes it can be; its first is its own choice of default.
		forms: (c) => (c.forms?.length ? ALL.filter((f) => c.forms!.includes(f)) : ALL),
		form: (c, given) => {
			const f = given ?? c.forms?.[0] ?? 'standard';
			return c.forms?.length && !c.forms.includes(f) ? c.forms[0]! : f;
		},
		name: (c) => c.label,
		star: false,
		// The plugin's own settings element stands in for a descriptor (CardSettings).
		options: null,
		defaults: {},
		addable: { pages: ['home', 'room'] },
		component: PluginKind
	},
	alerts: { ...one, ...fixed, name: () => 'Needs attention', component: AlertsKind },
	chips: { ...one, ...fixed, name: () => 'What’s going on', component: ChipsKind },
	modes: { ...one, ...fixed, name: () => 'Modes', component: ModesKind },
	summary: {
		...one,
		...fixed,
		name: () => 'The big numbers',
		options: () => summaryDescriptor(),
		defaults: SUMMARY_BUILT_IN,
		component: SummaryKind
	}
};

/** A card's kind, typed for the card in hand. */
export const kindOf = <C extends Card>(card: C): Kind<C['kind']> =>
	kinds[card.kind] as unknown as Kind<C['kind']>;
