/**
 * A thermostat's card (the board "The thermostat card"): what it reads, what
 * it is aiming at, whether it heats or cools, its schedule, and what − and +
 * send. Read from the shared names (`temperature`, `setpoint` or
 * `heat_setpoint`/`cool_setpoint`, `hvac_mode`, `hvac_action`,
 * `schedule_mode`, `hold_until`) and from the actions its schema declares, so
 * any plugin's thermostat gets it; nothing here knows a plugin.
 *
 * A thermostat with a schedule holds a new target rather than overwriting the
 * schedule: an action that writes `setpoint` and takes `hours` holds it for a
 * while (no hours: until the schedule's next change), one that writes it and
 * takes no hours holds it until changed, and one that writes `schedule_mode`
 * with nothing to fill in resumes the schedule.
 *
 * Temperatures here are in the person's units, as the card shows them.
 */
import type { CoreDevice, DeviceAction, Schema } from './devices.js';
import { fromShown, shownRange, shownUnit, toShown } from './units.js';

export type Doing = 'heating' | 'cooling' | 'idle' | 'off';
/** How long − and + hold a target: until the schedule changes, an hour, two, or until changed. */
export type HoldLength = 'next' | 'hour' | 'two' | 'perm';
export const HOLD_LENGTHS: HoldLength[] = ['next', 'hour', 'two', 'perm'];

export interface Thermostat {
	/** °F or °C, as the person reads. */
	unit: string;
	now?: number;
	/** The target − and + move: `setpoint`, or the heat or cool one by mode. */
	target?: number;
	attr: string;
	/** Both targets, when it keeps both and is in auto. */
	heat?: number;
	cool?: number;
	dual: boolean;
	doing: Doing;
	mode?: string;
	/** The modes a person may choose, where there's more than one. */
	modes: { value: string; label: string }[];
	min: number;
	max: number;
	step: number;
	/** `auto`, `hold`, `permanent_hold`; undefined without a schedule. */
	schedule?: string;
	/** When a hold ends, in ms, where the thermostat says. */
	holdUntil?: number;
	hold?: { id: string; hours: boolean };
	permanent?: string;
	resume?: string;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);
const params = (a: DeviceAction) => (a.params ?? []).map((p) => p.name);

/** The thermostat a device is, in the person's units. */
export function thermostatOf(d: CoreDevice): Thermostat {
	const a = d.attributes;
	const s: Schema = d.schema ?? { attributes: {} };
	const unitOf = (name: string) => s.attributes[name]?.unit ?? '°C';
	const shown = (name: string) => {
		const v = num(a[name]);
		return v === undefined ? undefined : toShown(v, unitOf(name));
	};
	const mode = str(a.hvac_mode);
	const modeSpec = s.attributes.hvac_mode;
	const modes = modeSpec?.writable
		? (modeSpec.options ?? []).map((o) =>
				typeof o === 'string'
					? { value: o, label: o[0]!.toUpperCase() + o.slice(1).replace(/_/g, ' ') }
					: { value: o.value, label: o.label ?? o.value }
			)
		: [];
	const hasHeat = 'heat_setpoint' in s.attributes;
	const hasCool = 'cool_setpoint' in s.attributes;
	const single = 'setpoint' in s.attributes || (!hasHeat && !hasCool);
	const dual = !single && hasHeat && hasCool && mode === 'auto';
	const attr = single
		? 'setpoint'
		: mode === 'cool' || !hasHeat
			? 'cool_setpoint'
			: 'heat_setpoint';
	const spec = s.attributes[attr];
	const r = shownRange(
		{ min: spec?.min ?? 5, max: spec?.max ?? 35, step: spec?.step ?? 0.5 },
		spec?.unit ?? '°C'
	);
	const unit = shownUnit(spec?.unit ?? '°C') ?? '°C';
	const action = str(a.hvac_action);
	const doing: Doing =
		mode === 'off' || action === 'off'
			? 'off'
			: action === 'heating'
				? 'heating'
				: action === 'cooling'
					? 'cooling'
					: 'idle';
	const actions = s.actions ?? [];
	const holdA = actions.find(
		(x) => x.writes === 'setpoint' && params(x).includes('setpoint') && params(x).includes('hours')
	);
	const permA = actions.find(
		(x) => x.writes === 'setpoint' && params(x).includes('setpoint') && !params(x).includes('hours')
	);
	const resumeA = actions.find((x) => x.writes === 'schedule_mode' && params(x).length === 0);
	const until = str(a.hold_until) ? Date.parse(a.hold_until as string) : NaN;
	return {
		unit,
		now: shown('temperature'),
		target: shown(attr),
		attr,
		...(dual ? { heat: shown('heat_setpoint'), cool: shown('cool_setpoint') } : {}),
		dual,
		doing,
		...(mode ? { mode } : {}),
		modes: modes.length > 1 ? modes : [],
		min: r.min!,
		max: r.max!,
		// Whole degrees in °F, halves in °C (a 0.5 °C step is about 1 °F).
		step: unit === '°F' ? 1 : 0.5,
		...(str(a.schedule_mode) ? { schedule: a.schedule_mode as string } : {}),
		...(Number.isFinite(until) ? { holdUntil: until } : {}),
		...(holdA ? { hold: { id: holdA.id, hours: true } } : {}),
		...(permA ? { permanent: permA.id } : {}),
		...(resumeA ? { resume: resumeA.id } : {})
	};
}

/** A step of − or + from `from`, on the step and inside the range. */
export function stepped(t: Pick<Thermostat, 'min' | 'max' | 'step'>, from: number, by: number) {
	const on = Math.round(from / t.step) * t.step;
	// A target already on a step, give or take what °C to °F leaves (75.002°),
	// moves a whole step; one between steps moves to the next in that direction.
	const between = Math.abs(on - from) > t.step * 0.05;
	const next = between && Math.sign(on - from) === Math.sign(by) ? on : on + by * t.step;
	return Math.min(t.max, Math.max(t.min, Math.round(next * 100) / 100));
}

/** What − and + send for a new target (in the person's units). */
export type Send =
	| { kind: 'action'; id: string; params: Record<string, unknown> }
	| { kind: 'set'; want: Record<string, unknown> };

export function sendFor(
	t: Thermostat,
	d: CoreDevice,
	shownTarget: number,
	length: HoldLength
): Send {
	const unit = d.schema?.attributes[t.attr]?.unit ?? '°C';
	const value = Math.round(fromShown(shownTarget, unit) * 100) / 100;
	// On a schedule it holds: a permanent hold stays one; otherwise as the card says.
	if (t.schedule !== undefined && (t.hold || t.permanent)) {
		const permanent = t.permanent && (length === 'perm' || t.schedule === 'permanent_hold');
		if (permanent) return { kind: 'action', id: t.permanent!, params: { setpoint: value } };
		if (t.hold) {
			const hours = length === 'hour' ? 1 : length === 'two' ? 2 : undefined;
			return {
				kind: 'action',
				id: t.hold.id,
				params: { setpoint: value, ...(hours ? { hours } : {}) }
			};
		}
	}
	return { kind: 'set', want: { [t.attr]: value } };
}

/** The hold lengths this thermostat can do. */
export function lengthsOf(t: Thermostat): HoldLength[] {
	if (t.schedule === undefined) return [];
	return HOLD_LENGTHS.filter((l) =>
		l === 'perm' ? t.permanent !== undefined : t.hold !== undefined
	);
}

/** Its schedule in words, for the chip: following it, held until when, or none. */
export function scheduleWords(t: Thermostat, at: (ms: number) => string): string {
	if (t.schedule === undefined) return 'No schedule';
	if (t.schedule === 'permanent_hold') return 'Held until changed';
	if (t.schedule === 'hold')
		return t.holdUntil !== undefined
			? `Held until ${at(t.holdUntil)}`
			: 'Held until the schedule changes';
	return 'Following its schedule';
}

/** The line under the temperature: what it's doing toward which target. */
export function targetWords(t: Thermostat, target = t.target): string {
	if (t.doing === 'off') return 'Off';
	if (t.dual && t.heat !== undefined && t.cool !== undefined)
		return `Heat ${deg(t.heat, t.unit)} · Cool ${deg(t.cool, t.unit)}`;
	if (target === undefined) return '';
	if (t.doing === 'heating') return `Heating to ${deg(target, t.unit)}`;
	if (t.doing === 'cooling') return `Cooling to ${deg(target, t.unit)}`;
	return `Target ${deg(target, t.unit)}`;
}

/** "75°": whole in °F, halves kept in °C. */
export function deg(v: number, unit: string): string {
	const r = unit === '°F' ? Math.round(v) : Math.round(v * 2) / 2;
	return `${r}°`;
}

// ---- the dial ----

export const DIAL = { w: 236, h: 200, cx: 118, cy: 112, r: 88, from: 135, sweep: 270 } as const;

/** Where a temperature sits on the dial: 0 at the low end of its range, 1 at the top. */
export function along(t: Pick<Thermostat, 'min' | 'max'>, v: number): number {
	if (t.max <= t.min) return 0;
	return Math.min(1, Math.max(0, (v - t.min) / (t.max - t.min)));
}

const point = (deg: number): [number, number] => [
	DIAL.cx + DIAL.r * Math.cos((deg * Math.PI) / 180),
	DIAL.cy + DIAL.r * Math.sin((deg * Math.PI) / 180)
];
const angle = (f: number) => DIAL.from + f * DIAL.sweep;
const fixed = (n: number) => Math.round(n * 10) / 10;

/** An arc of the dial between two fractions of it, as an SVG path. */
export function arc(f0: number, f1: number): string {
	const a0 = angle(Math.min(f0, f1));
	const a1 = angle(Math.max(f0, f1)) + 0.01;
	const [x0, y0] = point(a0);
	const [x1, y1] = point(a1);
	return `M${fixed(x0)} ${fixed(y0)} A${DIAL.r} ${DIAL.r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${fixed(x1)} ${fixed(y1)}`;
}

export interface Dial {
	track: string;
	/** Between now and the target, while it heats or cools. */
	fill?: string;
	cooling: boolean;
	now?: [number, number];
	target?: [number, number];
	/** The cool target's ring, in auto with both. */
	cool?: [number, number];
}

export function dialOf(t: Thermostat, target = t.target): Dial {
	const at = (v: number | undefined) =>
		v === undefined ? undefined : (point(angle(along(t, v))).map(fixed) as [number, number]);
	const cooling = t.doing === 'cooling';
	const aim = t.dual ? (cooling ? t.cool : t.heat) : target;
	const active = (t.doing === 'heating' || cooling) && t.now !== undefined && aim !== undefined;
	return {
		track: arc(0, 1),
		...(active ? { fill: arc(along(t, t.now!), along(t, aim!)) } : {}),
		cooling,
		now: at(t.now),
		target: at(t.dual ? t.heat : target),
		...(t.dual ? { cool: at(t.cool) } : {})
	};
}

// ---- − and + ----

/**
 * Presses of − and + gathered into one command: each press moves the target
 * shown at once, and what's sent goes when the presses stop.
 */
export class Nudge {
	value: number | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;
	constructor(
		private send: (value: number) => void,
		private delay = 900
	) {}

	press(t: Pick<Thermostat, 'min' | 'max' | 'step'>, from: number, by: number): number {
		this.value = stepped(t, this.value ?? from, by);
		clearTimeout(this.#timer);
		const v = this.value;
		this.#timer = setTimeout(() => this.send(v), this.delay);
		return v;
	}

	/** The target has arrived, or the wait is over: show the device's own again. */
	settle(): void {
		this.value = undefined;
	}

	/** The card is gone: send nothing more. */
	stop(): void {
		clearTimeout(this.#timer);
	}
}
