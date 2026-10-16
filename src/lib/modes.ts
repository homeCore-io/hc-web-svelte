/**
 * Modes (A1): states the whole house is in — Night, Away, Guests — for rules
 * to check. homeCore has three sorts: one that follows the sun, one people
 * and rules turn on and off, and one on whenever a condition holds (a manual
 * mode with a definition).
 */
import { slugOf } from './helpers.js';

export type SunEvent = 'Sunrise' | 'Sunset' | 'SolarNoon' | 'CivilDawn' | 'CivilDusk';

export interface ModeConfig {
	id: string;
	name: string;
	kind: 'solar' | 'manual';
	on_event?: SunEvent;
	off_event?: SunEvent;
	on_offset_minutes?: number;
	off_offset_minutes?: number;
}

export interface CoreMode {
	config: ModeConfig;
	state: { attributes: Record<string, unknown> } | null;
	definition: unknown | null;
}

const SUN: Record<SunEvent, string> = {
	Sunrise: 'sunrise',
	Sunset: 'sunset',
	SolarNoon: 'solar noon',
	CivilDawn: 'dawn',
	CivilDusk: 'dusk'
};
export const sunWords = (e: SunEvent | undefined) => (e ? SUN[e] : 'never');

/** "on time", "+15 min", "−30 min". */
export const offsetText = (n: number) =>
	n === 0 ? 'on time' : `${n > 0 ? '+' : '−'}${Math.abs(n)} min`;

/** How a mode decides, in a line. */
export function howOf(m: CoreMode): string {
	const c = m.config;
	if (c.kind === 'solar') {
		if (!c.on_event || !c.off_event) return 'Follows the sun — no times set';
		const on = sunWords(c.on_event);
		const off = sunWords(c.off_event);
		const at = (word: string, n: number | undefined) => (n ? `${word} ${offsetText(n)}` : word);
		const text = `${at(on, c.on_offset_minutes)} to ${at(off, c.off_offset_minutes)}`;
		return text[0]!.toUpperCase() + text.slice(1);
	}
	return m.definition ? 'On while a condition holds' : 'On or off by hand and by rules';
}

/** "18:27" → minutes after midnight, or null. */
export function minutes(hhmm: unknown): number | null {
	if (typeof hhmm !== 'string') return null;
	const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** When it's on today, as spans of the day in minutes; a night wraps midnight. */
export function spans(onAt: number, offAt: number): { from: number; to: number }[] {
	if (onAt === offAt) return [];
	return onAt < offAt
		? [{ from: onAt, to: offAt }]
		: [
				{ from: 0, to: offAt },
				{ from: onAt, to: 1440 }
			];
}

/** The id homeCore needs for a new mode: `mode_` and the name. */
export const modeIdFor = (name: string) => `mode_${slugOf(name)}`;

/** The built-in pair can't be deleted. */
export const builtIn = (id: string) => id === 'mode_night' || id === 'mode_day';
