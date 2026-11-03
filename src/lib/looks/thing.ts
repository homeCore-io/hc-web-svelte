/**
 * A thing as a made drawing reads it (13 §6.4): its values in plain names,
 * the same for expressions and for code. Nothing else of the app reaches a
 * made drawing.
 */
import type { CardView } from '../card.js';
import type { CoreDevice } from '../devices.js';
import type { Vars } from './expr.js';
import { colourOf } from '../lit/room.js';
import { readingUnit, toShown } from '../units.js';

/** Readings reach a drawing in °C, whatever unit the device reports in. */
const CORE = { temperature: 'C', measures: 'metric' } as const;

/** The names a drawing can read, with what each is, for the editor's help. */
export const THING_NAMES: Record<string, string> = {
	name: 'its name',
	on: 'whether it’s on',
	level: 'how bright, 0 to 100 (none if it doesn’t dim)',
	color: 'the color it gives off, as #rrggbb',
	room: 'its room',
	state: 'its state in words',
	temperature: 'its temperature reading',
	humidity: 'its humidity reading',
	available: 'whether it’s responding',
	alarm: 'what’s wrong, if anything',
	kind: 'what kind of thing it is',
	colors: 'a scene’s colors, as #rrggbb with commas between'
};

const hex = (rgb: string) =>
	'#' +
	rgb
		.split(',')
		.map((n) => Number(n).toString(16).padStart(2, '0'))
		.join('');

/** A scene as a made drawing reads it: on while it's the one on now. */
export function sceneThing(name: string, colors: string[], active: boolean, room: string): Vars {
	return {
		name,
		on: active,
		level: null,
		color: colors[0] ?? '#ffb45a',
		colors: colors.join(','),
		room,
		state: active ? 'On now' : 'Ready',
		temperature: null,
		humidity: null,
		available: true,
		alarm: null,
		kind: 'scene'
	};
}

/** A device's temperature in °C: its schema's unit, or the reading's own `_unit`, converted. */
export function celsius(d: CoreDevice, v: unknown): number | null {
	if (typeof v !== 'number') return null;
	const unit = readingUnit(d.schema?.attributes.temperature?.unit, d.attributes?.temperature_unit);
	return toShown(v, unit, CORE);
}

export function thingOf(d: CoreDevice, view: CardView, name: string, room: string): Vars {
	const a = d.attributes ?? {};
	const sw = view.control?.kind === 'switch' ? view.control : null;
	const dim = view.extras.find((e) => e.kind === 'slider' && e.attr === 'brightness_pct');
	const num = (v: unknown) => (typeof v === 'number' ? v : null);
	return {
		name,
		on: sw ? sw.on : view.tone === 'on',
		level: dim && dim.kind === 'slider' ? Math.round(dim.value) : null,
		color: hex(colourOf(d)),
		room,
		state: view.stateLine,
		temperature: celsius(d, a.temperature),
		humidity: num(a.humidity),
		available: view.available,
		alarm: view.alarm ?? null,
		kind: view.kind,
		colors: ''
	};
}
