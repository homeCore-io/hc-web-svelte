/**
 * A kind's options (G2, G4, G13): what each setting is, as a form-engine
 * descriptor, and where its value comes from. A setting is looked up layer by
 * layer, first set wins: this card's — the person's, then the household's —
 * then the person's every-room (kind) default, the household's, and the
 * kind's own. Each layer keeps only what it set, so the household changing a
 * default still reaches a person who changed something else.
 */
import { kindOf } from './card.js';
import type { Descriptor, Field } from './descriptor.js';
import type { CoreDevice } from './devices.js';
import { same } from './descriptor.js';

export type Options = Record<string, unknown>;

/** A setting's value through the layers, most particular first. */
export function resolve(layers: (Options | undefined)[], builtIn: Options): Options {
	const out: Options = { ...builtIn };
	for (const key of new Set([
		...Object.keys(builtIn),
		...layers.flatMap((l) => Object.keys(l ?? {}))
	])) {
		const set = layers.find((l) => l !== undefined && l[key] !== undefined);
		if (set) out[key] = set[key];
	}
	return out;
}

/**
 * What one layer needs to keep: the settings it gives that differ from what
 * would apply without it. Choosing the same as everyone else sets nothing.
 */
export function prune(mine: Options, without: Options): Options {
	const out: Options = {};
	for (const [k, v] of Object.entries(mine))
		if (v !== undefined && !same(v, without[k])) out[k] = v;
	return out;
}

/** The form engine's descriptor with each field's default set to what applies without this layer. */
export function withDefaults(d: Descriptor, without: Options): Descriptor {
	return {
		...d,
		sections: d.sections.map((s) => ({
			...s,
			fields: s.fields.map((f) =>
				f.key !== undefined && without[f.key] !== undefined ? { ...f, default: without[f.key] } : f
			)
		}))
	};
}

/** A sensor setting: the natural choice, none, or the devices chosen (one, or an average). */
export type Source = 'auto' | 'none' | string[];

export const sourceOf = (v: unknown): Source =>
	v === 'none'
		? 'none'
		: Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length > 0
			? v
			: 'auto';

// ---- a device's card (G23–G26; its sheet is deviceOptions.ts) ----

export const DEVICE_BUILT_IN: Options = {
	main: 'auto',
	last: false,
	tap: 'details',
	symbol: 'auto'
};

/** Where every card of a device's type keeps its default: `device:light`. */
export const deviceKind = (d: CoreDevice): string => `device:${kindOf(d)}`;

// ---- a room's box ----

export const BIG = ['temperature', 'humidity', 'lights', 'none'] as const;
export type Big = (typeof BIG)[number];

/** What a room box can show besides its big number, in the order they're offered. */
export const DETAILS = [
	['lights', 'Lights'],
	['doors', 'Locks'],
	['music', 'Music'],
	['people', 'Someone here'],
	['fans', 'Fans'],
	['timers', 'Timers'],
	['battery', 'Batteries']
] as const;
export type Detail = (typeof DETAILS)[number][0];

export const ROOM_BUILT_IN: Options = {
	big: 'temperature',
	temperature: 'auto',
	humidity: 'auto',
	lights: true,
	doors: true,
	music: true,
	people: true,
	fans: false,
	timers: true,
	battery: false,
	allOff: true
};

const sensor = (key: string, label: string, auto: string, capability: string): Field => ({
	kind: 'sensor',
	key,
	label,
	source: { kind: 'core_resource', ref: 'devices', capability },
	options: [
		{ value: 'auto', label: auto },
		{ value: 'none', label: `No ${label.split(' ')[0]!.toLowerCase()}` }
	],
	default: 'auto'
});

/** A room box's settings sheet. `near` puts that room's sensors first in the picker. */
export function roomDescriptor(near?: string): Descriptor {
	const s = (f: Field): Field => (near ? { ...f, near } : f);
	return {
		title: 'Room box',
		sections: [
			{
				id: 'big',
				title: 'Big number',
				fields: [
					{
						kind: 'enum',
						key: 'big',
						label: 'Big number',
						render: 'segmented',
						options: [
							{ value: 'temperature', label: 'Temperature' },
							{ value: 'humidity', label: 'Humidity' },
							{ value: 'lights', label: 'Lights on' },
							{ value: 'none', label: 'None' }
						],
						default: 'temperature'
					}
				]
			},
			{
				id: 'readings',
				title: 'Readings',
				fields: [
					s(
						sensor(
							'temperature',
							'Temperature from',
							'Average of the room’s sensors',
							'temperature'
						)
					),
					s(sensor('humidity', 'Humidity from', 'Average of the room’s sensors', 'humidity'))
				]
			},
			{
				id: 'show',
				title: 'Show on the box',
				fields: [
					...DETAILS.map(([key, label]): Field => ({
						kind: 'toggle',
						key,
						label,
						default: ROOM_BUILT_IN[key]
					})),
					{ kind: 'toggle', key: 'allOff', label: '“All off” button', default: true },
					{
						kind: 'note',
						text: 'An open door, a leak, smoke or a device that’s offline always shows, whatever is switched off here.'
					}
				]
			}
		]
	};
}

// ---- the big numbers ----

export const NUMBERS = [
	['inside', 'Inside'],
	['outside', 'Outside'],
	['lights', 'Lights on'],
	['playing', 'Playing'],
	['open', 'Open'],
	['people', 'Someone here'],
	['humidity', 'Humidity inside']
] as const;
export type NumberId = (typeof NUMBERS)[number][0];

export const SUMMARY_BUILT_IN: Options = {
	numbers: ['inside', 'outside', 'lights', 'playing', 'open'],
	inside: 'auto',
	outside: 'auto',
	humid: 'auto'
};

export const summaryDescriptor = (): Descriptor => ({
	title: 'The big numbers',
	sections: [
		{
			id: 'numbers',
			title: 'Numbers',
			fields: [
				{
					kind: 'list',
					render: 'order',
					key: 'numbers',
					label: 'Which numbers, in this order',
					options: NUMBERS.map(([value, label]) => ({ value, label })),
					default: SUMMARY_BUILT_IN.numbers
				}
			]
		},
		{
			id: 'readings',
			title: 'Readings',
			fields: [
				sensor('inside', 'Inside temperature from', 'Average of every room', 'temperature'),
				sensor(
					'outside',
					'Outside temperature from',
					'A weather station, if there is one',
					'temperature'
				),
				sensor('humid', 'Humidity inside from', 'Average of every room', 'humidity')
			]
		}
	]
});

/** Whether a stored list of numbers is usable: known ids, no repeats. */
export const numbersOf = (v: unknown): NumberId[] =>
	Array.isArray(v)
		? [...new Set(v.filter((x): x is NumberId => NUMBERS.some(([id]) => id === x)))]
		: (SUMMARY_BUILT_IN.numbers as NumberId[]);

// ---- the app's own cards (G-c, G21) ----

export const HEADING_BUILT_IN: Options = { text: 'Heading' };
export const headingDescriptor = (): Descriptor => ({
	title: 'Heading',
	sections: [
		{
			id: 'heading',
			title: 'Heading',
			fields: [{ kind: 'text', key: 'text', label: 'Words', default: 'Heading' }]
		}
	]
});

export const TEXT_BUILT_IN: Options = { text: '' };
export const textDescriptor = (): Descriptor => ({
	title: 'Note',
	sections: [
		{
			id: 'note',
			title: 'Note',
			fields: [
				{
					kind: 'text',
					key: 'text',
					label: 'What it says',
					render: 'multiline',
					placeholder: 'Bins go out Thursday night.',
					default: ''
				}
			]
		}
	]
});

export const WORTH_BUILT_IN: Options = { leaks: true, open: true, unlocked: true };
export const worthDescriptor = (): Descriptor => ({
	title: 'Worth knowing',
	sections: [
		{
			id: 'show',
			title: 'Show',
			fields: [
				{ kind: 'toggle', key: 'leaks', label: 'Leaks', default: true },
				{ kind: 'toggle', key: 'open', label: 'Doors and windows open', default: true },
				{ kind: 'toggle', key: 'unlocked', label: 'Locks unlocked', default: true }
			]
		}
	]
});

export const WEATHER_BUILT_IN: Options = { station: 'auto', clock: false };
export const weatherDescriptor = (): Descriptor => ({
	title: 'Weather',
	sections: [
		{
			id: 'from',
			title: 'From',
			fields: [
				{
					kind: 'sensor',
					key: 'station',
					label: 'Weather from',
					render: 'one',
					source: { kind: 'core_resource', ref: 'devices', capability: 'temperature' },
					options: [{ value: 'auto', label: 'The house’s weather, with a forecast if one has it' }],
					default: 'auto'
				},
				{
					kind: 'note',
					text: 'A forecast shows when the device has one — a weather plugin’s, say.'
				},
				{
					kind: 'toggle',
					key: 'clock',
					label: 'The time above it, and each day’s low to high',
					default: false
				}
			]
		}
	]
});

export const SPANS = [
	['6h', '6 hours', 6 * 3600_000],
	['24h', 'A day', 24 * 3600_000],
	['7d', 'A week', 7 * 24 * 3600_000],
	['30d', 'A month', 30 * 24 * 3600_000]
] as const;
export const spanOf = (v: unknown): number => (SPANS.find(([id]) => id === v) ?? SPANS[1])[2];

export const CHART_BUILT_IN: Options = {
	drawing: 'one',
	reading: 'temperature',
	temperature: 'none',
	humidity: 'none',
	compare_temperature: 'room',
	compare_humidity: 'room',
	style: 'lines',
	span: '24h'
};
const chartSensor = (key: 'temperature' | 'humidity', label: string): Field => ({
	kind: 'sensor',
	key,
	label,
	render: 'one',
	source: { kind: 'core_resource', ref: 'devices', capability: key },
	options: [],
	default: 'none',
	visible_when: {
		all: [
			{ field: 'reading', eq: key },
			{ field: 'drawing', eq: 'one' }
		]
	}
});
/** Several sensors to compare (13 §13.1, H1): this room's readings, or any chosen. */
const compareSensors = (key: 'temperature' | 'humidity', label: string): Field => ({
	kind: 'sensor',
	key: `compare_${key}`,
	label,
	render: 'many',
	source: { kind: 'core_resource', ref: 'devices', capability: key },
	options: [{ value: 'room', label: 'This room’s readings (on a room’s page)' }],
	default: 'room',
	visible_when: {
		all: [
			{ field: 'reading', eq: key },
			{ field: 'drawing', eq: 'compare' }
		]
	}
});
export const chartDescriptor = (): Descriptor => ({
	title: 'Chart',
	sections: [
		{
			id: 'what',
			title: 'What it charts',
			fields: [
				{
					kind: 'enum',
					key: 'drawing',
					label: 'Chart',
					render: 'segmented',
					options: [
						{ value: 'one', label: 'One reading' },
						{ value: 'compare', label: 'Several to compare' }
					],
					default: 'one'
				},
				{
					kind: 'enum',
					key: 'reading',
					label: 'Reading',
					render: 'segmented',
					options: [
						{ value: 'temperature', label: 'Temperature' },
						{ value: 'humidity', label: 'Humidity' }
					],
					default: 'temperature'
				},
				chartSensor('temperature', 'Temperature from'),
				chartSensor('humidity', 'Humidity from'),
				compareSensors('temperature', 'Temperatures from'),
				compareSensors('humidity', 'Humidity from'),
				{
					kind: 'enum',
					key: 'style',
					label: 'Drawn as',
					render: 'segmented',
					options: [
						{ value: 'lines', label: 'Lines' },
						{ value: 'range', label: 'Each day’s low to high' }
					],
					default: 'lines',
					visible_when: { field: 'drawing', eq: 'compare' }
				},
				{
					kind: 'enum',
					key: 'span',
					label: 'Over',
					render: 'segmented',
					options: SPANS.map(([value, label]) => ({ value, label })),
					default: '24h'
				}
			]
		}
	]
});

/** What a chart compares (H1): its reading, and this room's sensors or the ones chosen. */
export function compareSource(o: Options): {
	attr: 'temperature' | 'humidity';
	ids: string[] | 'room';
} {
	const attr = o.reading === 'humidity' ? 'humidity' : 'temperature';
	const s = sourceOf(o[`compare_${attr}`]);
	return { attr, ids: Array.isArray(s) ? s : 'room' };
}

/** The device a chart reads: the one chosen for its reading, if any. */
export function chartSource(o: Options): { attr: 'temperature' | 'humidity'; id?: string } {
	const attr = o.reading === 'humidity' ? 'humidity' : 'temperature';
	const s = sourceOf(o[attr]);
	return { attr, id: Array.isArray(s) ? s[0] : undefined };
}

// ---- widgets for laying out a page (14 §6, P8) ----

export const TITLE_BUILT_IN: Options = { text: 'Title', sub: '' };
export const titleDescriptor = (): Descriptor => ({
	title: 'Title',
	sections: [
		{
			id: 'title',
			title: 'Title',
			fields: [
				{ kind: 'text', key: 'text', label: 'Words', default: 'Title' },
				{ kind: 'text', key: 'sub', label: 'A line under it', default: '' }
			]
		}
	]
});

export const DIVIDER_BUILT_IN: Options = { text: '' };
export const dividerDescriptor = (): Descriptor => ({
	title: 'Divider',
	sections: [
		{
			id: 'divider',
			title: 'Divider',
			fields: [
				{
					kind: 'text',
					key: 'text',
					label: 'Words in the line',
					placeholder: 'None: just a line',
					default: ''
				}
			]
		}
	]
});

export const PICTURE_BUILT_IN: Options = { src: '', fit: 'cover', caption: '' };
export const pictureDescriptor = (): Descriptor => ({
	title: 'Picture',
	sections: [
		{
			id: 'picture',
			title: 'Picture',
			fields: [
				{ kind: 'text', key: 'src', label: 'What it shows', render: 'picture', default: '' },
				{
					kind: 'enum',
					key: 'fit',
					label: 'In its place',
					render: 'segmented',
					options: [
						{ value: 'cover', label: 'Fill it' },
						{ value: 'contain', label: 'Show all of it' }
					],
					default: 'cover'
				},
				{ kind: 'text', key: 'caption', label: 'Caption', default: '' }
			]
		}
	]
});

export const LINK_BUILT_IN: Options = { to: 'home', text: '' };
export const linkDescriptor = (choices: { value: string; label: string }[]): Descriptor => ({
	title: 'Link',
	sections: [
		{
			id: 'link',
			title: 'Link',
			fields: [
				{ kind: 'select', key: 'to', label: 'Opens', options: choices, default: 'home' },
				{
					kind: 'text',
					key: 'text',
					label: 'Its words',
					placeholder: 'The page’s name',
					default: ''
				}
			]
		}
	]
});

export const CLOCK_BUILT_IN: Options = { date: true, seconds: false };
export const clockDescriptor = (): Descriptor => ({
	title: 'Clock',
	sections: [
		{
			id: 'clock',
			title: 'Clock',
			fields: [
				{ kind: 'toggle', key: 'date', label: 'The date under it', default: true },
				{ kind: 'toggle', key: 'seconds', label: 'Seconds', default: false }
			]
		}
	]
});
