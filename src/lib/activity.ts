/**
 * A device's recent activity in words, saying who or what changed it (D3):
 * "On · at the wall", "Brightness 40% · by Evening", "Locked · by sam".
 *
 * From homeCore's recent events for the device (`GET /events?device_id=`),
 * which carry each change's provenance.
 */
import { reading } from './card.js';
import type { Change, Schema } from './devices.js';

export interface StateEvent {
	timestamp: string;
	changed: string[];
	current: Record<string, unknown>;
	change?: Change;
}

export interface ActivityLine {
	at: string;
	text: string;
}

/** Attributes that move without anyone doing anything. */
const NOISE =
	/^(last_seen|rssi|lqi|signal|uptime|battery_volts|remaining_secs)$|position|duration|_ms$|_at$|screensaver/;

export function activityOf(events: StateEvent[], s: Schema, limit = 8): ActivityLine[] {
	const lines: ActivityLine[] = [];
	for (const e of [...events].sort((x, y) => y.timestamp.localeCompare(x.timestamp))) {
		const what = e.changed
			.filter((name) => !NOISE.test(name) && s.attributes[name]?.category === undefined)
			.map((name) => {
				const v = reading(e.current, s, name);
				if (v === undefined) return undefined;
				// A boolean says itself ("On", "Open"); a level says what it is.
				return typeof e.current[name] === 'boolean' ? v : `${label(name)} ${v}`;
			})
			.filter((x): x is string => x !== undefined);
		if (what.length === 0) continue;
		const who = byWhom(e.change);
		lines.push({ at: e.timestamp, text: [what.join(', '), who].filter(Boolean).join(' · ') });
		if (lines.length >= limit) break;
	}
	return lines;
}

export function byWhom(c: Change | undefined): string {
	if (!c) return '';
	if (c.kind === 'physical') return 'at the wall';
	if (c.source === 'rule') return c.actor_name ? `by ${c.actor_name}` : 'by a rule';
	if (c.source === 'scene') return c.actor_name ? `by ${c.actor_name}` : 'by a scene';
	if (c.source === 'api' || c.kind === 'homecore') return c.actor_name ? `by ${c.actor_name}` : '';
	if (c.kind === 'external')
		return c.source ? `from ${c.source.replace(/_/g, ' ')}` : 'from its app';
	return '';
}

function label(name: string): string {
	const w = name.replace(/_(pct|secs|w)$/, '').replace(/[_.]+/g, ' ');
	return w[0]!.toUpperCase() + w.slice(1);
}
