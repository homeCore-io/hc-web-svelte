/**
 * Where a Link widget can open (14 §6): Home, Scenes, Alerts, each room, and
 * the house's and this person's pages, as `home`, `room:<id>`, `page:<id>`.
 */
import { rooms } from './rooms.svelte.js';
import { household } from './household.svelte.js';
import { personal } from './personal.svelte.js';
import { listPages } from './built.js';

const FIXED: Record<string, { label: string; href: string }> = {
	home: { label: 'Home', href: '/' },
	scenes: { label: 'Scenes', href: '/scenes' },
	alerts: { label: 'Alerts', href: '/alerts' }
};

export function linkChoices(): { value: string; label: string }[] {
	return [
		...Object.entries(FIXED).map(([value, f]) => ({ value, label: f.label })),
		...rooms.list.map((r) => ({ value: `room:${r.id}`, label: r.name })),
		...listPages(household.doc, personal.doc).map((p) => ({
			value: `page:${p.id}`,
			label: p.name
		}))
	];
}

/** Where a link goes and what it's called; none, if what it named is gone. */
export function linkTo(to: string): { href: string; label: string } | undefined {
	if (FIXED[to]) return FIXED[to];
	if (to.startsWith('room:')) {
		const r = rooms.list.find((x) => x.id === to.slice(5));
		return r && { href: `/rooms/${r.id}`, label: r.name };
	}
	if (to.startsWith('page:')) {
		const p = listPages(household.doc, personal.doc).find((x) => x.id === to.slice(5));
		return p && { href: `/pages/${p.id}`, label: p.name };
	}
	return undefined;
}
