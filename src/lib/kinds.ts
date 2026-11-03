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
import {
	CHART_BUILT_IN,
	DEVICE_BUILT_IN,
	HEADING_BUILT_IN,
	ROOM_BUILT_IN,
	SUMMARY_BUILT_IN,
	TEXT_BUILT_IN,
	WEATHER_BUILT_IN,
	WORTH_BUILT_IN,
	chartDescriptor,
	headingDescriptor,
	roomDescriptor,
	summaryDescriptor,
	textDescriptor,
	weatherDescriptor,
	worthDescriptor
} from './options.js';
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
	/**
	 * Where the room field style draws it (mockup A): in the side column, as
	 * the phone's one-line summary of the alerts, or as the band of numbers.
	 */
	place?: Place;
}

export type Place = 'side' | 'brief' | 'band';

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
	/** Whether this card has a settings sheet, where `options` doesn't say (a device's is built when opened). */
	settable?: (card: CardOf<K>) => boolean;
	/** The settings it has before anyone sets any. */
	defaults: Record<string, unknown>;
	/** Whether Add offers it, and on which pages. */
	addable: false | { pages: ('home' | 'room')[] };
	/** How Add's Cards tab offers one of the app's own cards (G-c). */
	offer?: { name: string; sub: string };
	/** Open its settings as soon as it's added: it shows nothing until set (a note, a chart). */
	setFirst?: boolean;
	/** Drawn the whole width of its section (a heading). */
	wide?: boolean;
	/** What draws it — imported with the registry, or `load`ed when first drawn (G-c, 06 V5). */
	component?: Component<KindProps<K>>;
	load?: () => Promise<{ default: Component<KindProps<K>> }>;
}

/** A component loaded once, the first time anything asks for it. */
function lazy<K extends Card['kind']>(
	f: () => Promise<{ default: Component<KindProps<K>> }>
): () => Promise<{ default: Component<KindProps<K>> }> {
	let p: Promise<{ default: Component<KindProps<K>> }> | undefined;
	return () => (p ??= f());
}

const ALL: Form[] = ['compact', 'standard', 'large'];
const one = { forms: () => [], form: () => undefined };
const fixed = { star: false, options: null, defaults: {}, addable: false as const };
const anywhere = { pages: ['home', 'room'] as ('home' | 'room')[] };

export const kinds: { [K in Card['kind']]: Kind<K> } = {
	device: {
		forms: (c) => (c.scene ? [] : ALL),
		form: (c, given) => (c.scene ? undefined : (given ?? c.form ?? 'standard')),
		name: (c) => displayName(c.device),
		star: true,
		// Built for the device when its sheet opens (deviceOptions.ts, G23).
		options: null,
		settable: (c) => !c.scene,
		defaults: DEVICE_BUILT_IN,
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
	},
	heading: {
		...one,
		name: () => 'Heading',
		star: false,
		options: () => headingDescriptor(),
		defaults: HEADING_BUILT_IN,
		addable: anywhere,
		offer: { name: 'Heading', sub: 'A title to split a section' },
		setFirst: true,
		wide: true,
		load: lazy(() => import('./components/kinds/HeadingKind.svelte'))
	},
	text: {
		...one,
		name: () => 'Note',
		star: false,
		options: () => textDescriptor(),
		defaults: TEXT_BUILT_IN,
		addable: anywhere,
		offer: { name: 'Text', sub: 'A note for the household, or yourself' },
		setFirst: true,
		load: lazy(() => import('./components/kinds/TextKind.svelte'))
	},
	worth: {
		...one,
		name: () => 'Worth knowing',
		star: false,
		options: () => worthDescriptor(),
		defaults: WORTH_BUILT_IN,
		addable: anywhere,
		offer: { name: 'Worth knowing', sub: 'Leaks, what’s open or unlocked, what’s playing' },
		load: lazy(() => import('./components/kinds/WorthKind.svelte'))
	},
	playing: {
		...one,
		name: () => 'Playing',
		star: false,
		options: null,
		defaults: {},
		addable: anywhere,
		offer: { name: 'Playing', sub: 'Every speaker and TV that’s on' },
		load: lazy(() => import('./components/kinds/PlayingKind.svelte'))
	},
	weather: {
		...one,
		name: () => 'Weather',
		star: false,
		options: () => weatherDescriptor(),
		defaults: WEATHER_BUILT_IN,
		addable: anywhere,
		offer: { name: 'Weather', sub: 'Your weather station now; a forecast where there is one' },
		load: lazy(() => import('./components/kinds/WeatherKind.svelte'))
	},
	chart: {
		...one,
		name: () => 'Chart',
		star: false,
		options: () => chartDescriptor(),
		defaults: CHART_BUILT_IN,
		addable: anywhere,
		offer: { name: 'Chart', sub: 'A temperature or humidity over time' },
		setFirst: true,
		load: lazy(() => import('./components/kinds/ChartKind.svelte'))
	},
	// A look's frame pieces and groups (13 §6, §7): drawn only by a look that has
	// them, so they load only then.
	roomhead: {
		...one,
		...fixed,
		name: () => 'Room header',
		wide: true,
		load: lazy(() => import('./lit/RoomHeadKind.svelte'))
	},
	needs: {
		...one,
		...fixed,
		name: () => 'Needs you',
		wide: true,
		load: lazy(() => import('./lit/NeedsKind.svelte'))
	},
	lampgroup: {
		...one,
		...fixed,
		name: (c) => c.name,
		load: lazy(() => import('./lit/LampGroupKind.svelte'))
	}
};

/** A card's kind, typed for the card in hand. */
export const kindOf = <C extends Card>(card: C): Kind<C['kind']> =>
	kinds[card.kind] as unknown as Kind<C['kind']>;
