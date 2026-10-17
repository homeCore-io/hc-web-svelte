/**
 * A rule's unsaved draft (E6), kept in this browser so leaving the page
 * doesn't lose it — a convenience, not a store: anything may clear it.
 * Kept with the version it started from, so a draft of a rule someone has
 * since changed isn't silently put back over theirs.
 */
import type { Rule } from './ruleWords.js';

export interface Kept {
	base: Rule | null;
	draft: Rule;
}

const key = (id: string) => `hc.ruleDraft.${id || 'new'}`;

export function readDraft(id: string): Kept | null {
	try {
		const raw = localStorage.getItem(key(id));
		return raw ? (JSON.parse(raw) as Kept) : null;
	} catch {
		return null;
	}
}

export function keepDraft(id: string, kept: Kept): void {
	try {
		localStorage.setItem(key(id), JSON.stringify(kept));
	} catch {
		// Private windows and full storage: the draft lives only while the page does.
	}
}

export function dropDraft(id: string): void {
	try {
		localStorage.removeItem(key(id));
	} catch {
		// Nothing kept.
	}
}

/** The same rule, whatever order its fields came in. */
export const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

function canonical(v: unknown): string {
	return JSON.stringify(v, (_k, x: unknown) =>
		x && typeof x === 'object' && !Array.isArray(x)
			? Object.fromEntries(
					Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
				)
			: x
	);
}
