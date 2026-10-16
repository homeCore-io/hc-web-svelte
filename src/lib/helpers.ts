/**
 * Helpers (A1): devices homeCore itself provides for rules to use — timers,
 * switches, counters and the rest (homeCore's "glue"). Each kind is described
 * here in the config-descriptor vocabulary, so the A0 form engine edits them.
 *
 * What homeCore accepts differs between making a helper and changing it
 * (`create_glue` vs `update_glue`'s whitelist); both are spelled out per kind.
 */
import type { Descriptor, Field } from './descriptor.js';

export type HelperType =
	| 'switch'
	| 'timer'
	| 'counter'
	| 'number'
	| 'select'
	| 'text'
	| 'button'
	| 'datetime'
	| 'group'
	| 'threshold'
	| 'schedule';

export interface HelperKind {
	type: HelperType;
	label: string;
	plural: string;
	what: string;
	/** Settings when making one. */
	create: Field[];
	/** Settings homeCore lets change afterwards (its whitelist). */
	edit: Field[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const f = (key: string, kind: string, label: string, more: Partial<Field> = {}): Field => ({
	key,
	kind,
	label,
	...more
});

const counter = [
	f('step', 'int', 'Step', { help: 'How much each count adds.', default: 1, min: 1 }),
	f('min', 'int', 'Lowest', { help: 'Empty for no limit.' }),
	f('max', 'int', 'Highest', { help: 'Empty for no limit.' })
];
const number = [
	f('min', 'number', 'Lowest', { default: 0 }),
	f('max', 'number', 'Highest', { default: 100 }),
	f('step', 'number', 'Step', { default: 1 }),
	f('unit', 'text', 'Unit', { placeholder: '%' })
];
const select = [
	f('options', 'list', 'Choices', { item: 'text', required: true, placeholder: 'Home' })
];
const text = [f('max_length', 'int', 'Longest', { unit: 'characters', min: 1 })];
const datetime = [
	f('has_date', 'toggle', 'Has a date', { default: true }),
	f('has_time', 'toggle', 'Has a time', { default: true })
];
const group = (devices: { value: string; label: string }[]): Field[] => [
	f('member_ids', 'list', 'Members', { item: 'text', options: devices, required: true }),
	f('attribute', 'text', 'Reading', {
		help: 'What each member reports — on, open, motion.',
		default: 'on'
	}),
	f('mode', 'enum', 'On when', {
		render: 'segmented',
		default: 'any',
		options: [
			{ value: 'any', label: 'Any is' },
			{ value: 'all', label: 'All are' }
		]
	}),
	f('expect', 'toggle', 'Counts as on when true', { default: true })
];
const threshold = (devices: { value: string; label: string }[]): Field[] => [
	f('source_device_id', 'select', 'Device', { options: devices, required: true }),
	f('source_attribute', 'text', 'Reading', { default: 'value', placeholder: 'humidity' }),
	f('threshold', 'number', 'Above', { default: 0 }),
	f('hysteresis', 'number', 'Back below by', {
		help: 'How far it must fall before it turns off again, so it doesn’t flicker.',
		default: 0
	})
];
const timer = [
	f('duration_mins', 'number', 'Runs for', {
		unit: 'minutes',
		min: 0,
		help: 'Unless a rule starts it for longer.'
	}),
	f('repeat', 'toggle', 'Start again when it finishes', { default: false })
];
const schedule: Field[] = [
	{
		key: 'blocks',
		kind: 'table',
		label: 'On during',
		item: [
			f('days', 'list', 'Days', {
				item: 'text',
				options: DAYS.map((d) => ({ value: d, label: d }))
			}),
			f('start', 'text', 'From', { placeholder: '08:00' }),
			f('end', 'text', 'Until', { placeholder: '17:00' })
		]
	}
];

/** Every kind. `devices` are the house's devices, for groups and thresholds to pick from. */
export function helperKinds(devices: { value: string; label: string }[] = []): HelperKind[] {
	return [
		{
			type: 'switch',
			label: 'Switch',
			plural: 'Switches',
			what: 'On or off, set by people or rules — Vacation, Guests.',
			create: [],
			edit: []
		},
		{
			type: 'timer',
			label: 'Timer',
			plural: 'Timers',
			what: 'Counts down; rules act when it finishes — the bathroom fan.',
			create: timer,
			edit: timer
		},
		{
			type: 'counter',
			label: 'Counter',
			plural: 'Counters',
			what: 'Counts up or down — how often the deck door opened.',
			create: counter,
			edit: counter
		},
		{
			type: 'number',
			label: 'Number',
			plural: 'Numbers',
			what: 'A value people set within limits — target humidity.',
			create: [f('value', 'number', 'Starts at', { default: 0 }), ...number],
			edit: number
		},
		{
			type: 'select',
			label: 'Select',
			plural: 'Selects',
			what: 'One of a list — Home, Away, Vacation, Guest.',
			create: select,
			edit: select
		},
		{
			type: 'text',
			label: 'Text',
			plural: 'Texts',
			what: 'Words a rule or a person sets.',
			create: text,
			edit: text
		},
		{
			type: 'button',
			label: 'Button',
			plural: 'Buttons',
			what: 'Something to press; rules react to the press.',
			create: [],
			edit: []
		},
		{
			type: 'datetime',
			label: 'Date & time',
			plural: 'Dates & times',
			what: 'A moment people set — the wake-up time.',
			create: datetime,
			edit: datetime
		},
		{
			type: 'group',
			label: 'Group',
			plural: 'Groups',
			what: 'Several devices as one — “a deck door is open” if any is.',
			create: group(devices),
			edit: group(devices)
		},
		{
			type: 'threshold',
			label: 'Threshold',
			plural: 'Thresholds',
			what: 'On while a reading is past a value — office humidity high.',
			create: threshold(devices),
			edit: threshold(devices)
		},
		{
			type: 'schedule',
			label: 'Schedule',
			plural: 'Schedules',
			what: 'On during blocks of the week — weekdays 8 to 5.',
			create: schedule,
			// homeCore can't change a schedule's blocks once it's made.
			edit: schedule.map((x) => ({ ...x, read_only: true }))
		}
	];
}

export const kindOf = (type: string, devices: { value: string; label: string }[] = []) =>
	helperKinds(devices).find((k) => k.type === type);

/** As a one-section descriptor, for the form engine. */
export function descriptorOf(fields: Field[], title = ''): Descriptor {
	return { sections: [{ id: 'helper', title, fields }] };
}

/** "Deck Door Opens" → "deck_door_opens"; homeCore adds the kind's prefix. */
export function slugOf(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/** The device id homeCore will give it. */
export const idFor = (type: string, name: string) => `${type}_${slugOf(name)}`;

/** Form values from a helper's attributes (its config lives there). */
export function valuesFrom(type: string, attrs: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = { ...attrs };
	if (type === 'timer' && typeof attrs.duration_secs === 'number')
		out.duration_mins = attrs.duration_secs / 60;
	return out;
}

/** Form values → homeCore's config, for the given fields only. */
export function configFrom(type: string, fields: Field[], values: Record<string, unknown>) {
	const config: Record<string, unknown> = {};
	for (const field of fields) {
		if (!field.key || field.read_only) continue;
		const v = values[field.key];
		if (v === undefined) continue;
		if (type === 'timer' && field.key === 'duration_mins')
			config.duration_secs = Math.round(Number(v) * 60);
		else config[field.key] = v;
	}
	return config;
}

/** The body for `POST /glue`. Groups are made with `members`, read back as `member_ids`. */
export function createBody(type: string, name: string, values: Record<string, unknown>) {
	const kind = kindOf(type);
	const config = configFrom(type, kind?.create ?? [], values);
	if ('member_ids' in config) {
		config.members = config.member_ids;
		delete config.member_ids;
	}
	return { type, id: slugOf(name), name: name.trim(), config };
}

/** Whether a device is one of homeCore's helpers. */
export const isHelper = (d: { plugin_id?: string }) =>
	d.plugin_id === 'core.glue' || d.plugin_id === 'core.timer' || d.plugin_id === 'core.switch';

/** Clock text for seconds: 2:18, 1:02:05. */
export function clock(secs: number): string {
	const s = Math.max(0, Math.round(secs));
	const m = Math.floor(s / 60);
	return m >= 60
		? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
		: `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds a running timer has left now, from when it started. */
export function remaining(attrs: Record<string, unknown>, now: number): number | null {
	if (attrs.state !== 'running') return null;
	const total = Number(attrs.duration_secs);
	const started = typeof attrs.started_at === 'string' ? Date.parse(attrs.started_at) : NaN;
	if (Number.isFinite(total) && Number.isFinite(started))
		return Math.max(0, total - (now - started) / 1000);
	const left = Number(attrs.remaining_secs);
	return Number.isFinite(left) ? left : null;
}
