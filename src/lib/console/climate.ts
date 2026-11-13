/**
 * A room's Climate tab in the console (the Garage, Office and FamilyRoom
 * boards): what sets the room's air. Each thermostat with a dial, − and +,
 * and its modes or schedule, beside the switch it runs (shown, never
 * switched, so a hand doesn't fight it); then fans with their speeds; then
 * the plain switches named for a heater or humidifier.
 *
 * Temperatures here are in the person's units, as `thermostatOf` gives them.
 * Pure: the tab draws what this decides.
 */
import { kindOf } from '../card.js';
import { unitOf, type CoreDevice } from '../devices.js';
import { fromShown, toShown, units, type Units } from '../units.js';
import type { Send, Thermostat } from '../thermostat.js';

export interface ClimateTab {
	/** Each thermostat, with the switch it runs when it says. */
	thermostats: { device: CoreDevice; runs?: CoreDevice }[];
	fans: CoreDevice[];
	/** Everything else here: switched on and off by hand. */
	switches: CoreDevice[];
}

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);

/** The tab's parts, from its devices; `byId` finds a switch a thermostat runs from another room. */
export function climateTab(
	devices: CoreDevice[],
	byId: Record<string, CoreDevice> = {}
): ClimateTab {
	const here = new Map(devices.map((d) => [d.device_id, d]));
	const thermostats = devices
		.filter((d) => kindOf(d) === 'thermostat')
		.map((d) => {
			const id = str(d.attributes.actuator_device_id);
			const runs = id ? (here.get(id) ?? byId[id]) : undefined;
			return runs ? { device: d, runs } : { device: d };
		});
	const run = new Set(thermostats.map((t) => t.runs?.device_id));
	const rest = devices.filter((d) => kindOf(d) !== 'thermostat' && !run.has(d.device_id));
	return {
		thermostats,
		fans: rest.filter((d) => kindOf(d) === 'fan'),
		switches: rest.filter((d) => kindOf(d) !== 'fan')
	};
}

// ---- the dial ----

/**
 * The span of temperatures the dial draws: 5 °C to 35 °C in the person's
 * units (a room's range, not the thermostat's widest), stretched to take in
 * the temperature now and the target, and kept inside what the thermostat takes.
 */
export function dialSpan(
	t: Pick<Thermostat, 'unit' | 'min' | 'max' | 'now' | 'target'>,
	u: Units = units()
): { lo: number; hi: number } {
	const own = (c: number) => (t.unit === '°' ? c : toShown(c, '°C', u));
	const seen = [t.now, t.target].filter((v): v is number => v !== undefined);
	const lo = Math.max(t.min, Math.min(own(5), ...seen));
	const hi = Math.min(t.max, Math.max(own(35), ...seen));
	return hi > lo ? { lo, hi } : { lo: t.min, hi: t.max };
}

/** Where a temperature sits on the dial, 0 to 1. */
export function dialAt(span: { lo: number; hi: number }, v: number | undefined): number {
	if (v === undefined || span.hi <= span.lo) return 0;
	return Math.min(1, Math.max(0, (v - span.lo) / (span.hi - span.lo)));
}

/** What the dial's middle says above the target. */
export function aimWord(t: Pick<Thermostat, 'mode' | 'doing'>): string {
	if (t.mode === 'cool' || t.doing === 'cooling') return 'Cool to';
	if (t.mode === 'heat' || t.doing === 'heating') return 'Heat to';
	return 'Set to';
}

// ---- a schedule's choices ----

export type Plan = 'auto' | 'hold' | 'permanent_hold';

const PLAN_WORDS: Record<Plan, string> = {
	auto: 'Schedule',
	hold: 'Hold',
	permanent_hold: 'Until changed'
};

/** A thermostat's schedule as choices, where it has one and the actions to change it. */
export function plansOf(t: Thermostat): { id: Plan; label: string }[] {
	if (t.schedule === undefined) return [];
	const have: Plan[] = [
		...(t.resume ? (['auto'] as const) : []),
		...(t.hold ? (['hold'] as const) : []),
		...(t.permanent ? (['permanent_hold'] as const) : [])
	];
	return have.length > 1 ? have.map((id) => ({ id, label: PLAN_WORDS[id] })) : [];
}

/** What choosing a plan sends: resume the schedule, or hold today's target. */
export function planSend(t: Thermostat, d: CoreDevice, plan: Plan): Send | undefined {
	if (plan === 'auto') return t.resume ? { kind: 'action', id: t.resume, params: {} } : undefined;
	if (t.target === undefined) return undefined;
	const setpoint = Math.round(fromShown(t.target, unitOf(d, t.attr)) * 100) / 100;
	if (plan === 'hold' && t.hold) return { kind: 'action', id: t.hold.id, params: { setpoint } };
	if (plan === 'permanent_hold' && t.permanent)
		return { kind: 'action', id: t.permanent, params: { setpoint } };
	return undefined;
}

// ---- fans ----

export interface FanSpeeds {
	/** Off first, then each speed the fan names. */
	options: string[];
	value: string;
}

const optionValues = (d: CoreDevice, attr: string): string[] =>
	(d.schema?.attributes[attr]?.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));

/** A fan's speeds to choose from, where it names them and takes them. */
export function fanSpeeds(d: CoreDevice): FanSpeeds | undefined {
	if (!d.schema?.attributes.speed?.writable) return undefined;
	const named = optionValues(d, 'speed');
	if (named.filter((o) => o !== 'off').length === 0) return undefined;
	const options = named.includes('off') ? named : ['off', ...named];
	const a = d.attributes;
	const speed = str(a.speed);
	const value = a.on === false || speed === undefined ? 'off' : speed;
	return { options, value: options.includes(value) ? value : 'off' };
}

/** What choosing a speed sends: the speed, or off where the fan has no "off" speed. */
export function speedWant(d: CoreDevice, option: string): Record<string, unknown> {
	if (option === 'off' && !optionValues(d, 'speed').includes('off')) return { on: false };
	return { speed: option };
}

/** A speed's name on its button. */
export function speedLabel(option: string): string {
	const short: Record<string, string> = { medium: 'Med', 'medium-high': 'Med hi' };
	const w = short[option] ?? option.replace(/[-_]/g, ' ');
	return w.charAt(0).toUpperCase() + w.slice(1);
}

/** How long one turn of the fan's drawing takes, in seconds, at a speed: 0 when still. */
export function spinOf(speeds: FanSpeeds): number {
	const on = speeds.options.filter((o) => o !== 'off');
	const i = on.indexOf(speeds.value);
	if (i < 0) return 0;
	if (on.length === 1) return 1;
	return Math.round((1.8 - (i / (on.length - 1)) * 1.3) * 100) / 100;
}

/**
 * Whose a thermostat's reading is, beside it on its dial: the thermostat's
 * own ("Thermostat"), never the room's name, since the room's temperature
 * may come from a thermometer and differ; "Floor" for a floor's heat.
 */
export function readingName(d: CoreDevice): string {
	const said = d.schema?.attributes.temperature?.display_name;
	return said && !/^temperature$/i.test(said) ? said.replace(/\s+temperature$/i, '') : 'Thermostat';
}
