/**
 * A kind's options (G2, G4, G13): what each setting is, as a form-engine
 * descriptor, and where its value comes from. A setting is looked up layer by
 * layer, first set wins: this card's — the person's, then the household's —
 * then the person's every-room (kind) default, the household's, and the
 * kind's own. Each layer keeps only what it set, so the household changing a
 * default still reaches a person who changed something else.
 */
import type { Descriptor, Field } from './descriptor.js';
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
