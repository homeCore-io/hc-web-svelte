/**
 * A command waiting for the house to confirm it (C8), as plain data.
 *
 * The card shows the new position at once, marked as waiting, and goes back
 * if the device hasn't reported it in time. **Confirmed means the device
 * reports what was asked for** — homeCore doesn't hand back the correlation
 * id of a command it accepted, and what a person cares about is the light
 * being on, whoever turned it on (B6).
 */
import type { CardView } from './card.js';
import { toShown } from './units.js';

export interface Pending {
	/** Attribute values asked for. */
	want: Record<string, unknown>;
	/** When to give up, in ms since the epoch. */
	until: number;
}

/** How long a kind gets to confirm. Locks are slow (C8). */
export function patienceFor(kind: string): number {
	return kind === 'lock' ? 20_000 : 5_000;
}

/** Whether a device's attributes show what was asked for. */
export function confirmed(want: Record<string, unknown>, attrs: Record<string, unknown>): boolean {
	return Object.entries(want).every(([key, value]) => same(value, attrs[key]));
}

function same(want: unknown, got: unknown): boolean {
	if (typeof want === 'number' && typeof got === 'number') {
		// Bridges round: 80% may come back as 79.6.
		return Math.abs(want - got) <= Math.max(1, Math.abs(want) * 0.02);
	}
	return want === got;
}

/** The card as it should look while a command is pending: its new position, waiting. */
export function withPending(
	card: CardView,
	p: Pending | undefined
): CardView & { waiting: boolean } {
	if (p === undefined) return { ...card, waiting: false };
	const w = p.want;
	let control = card.control;
	if (control?.kind === 'switch' && typeof w[control.attr] === 'boolean') {
		control = { ...control, on: w[control.attr] as boolean };
	} else if (control?.kind === 'lock' && typeof w.locked === 'boolean') {
		control = { ...control, locked: w.locked };
	}
	const extras = card.extras.map((e) =>
		e.kind === 'slider' && typeof w[e.attr] === 'number'
			? { ...e, value: e.from ? toShown(w[e.attr] as number, e.from) : (w[e.attr] as number) }
			: e.kind === 'steps' && typeof w[e.attr] === 'string'
				? { ...e, value: w[e.attr] as string }
				: e
	);
	const channels = card.channels.map((c) =>
		typeof w[c.attr] === 'boolean' ? { ...c, on: w[c.attr] as boolean } : c
	);
	return { ...card, control, extras, channels, waiting: true };
}
